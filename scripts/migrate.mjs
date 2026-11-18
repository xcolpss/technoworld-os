import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { getDbConfig } from "./pg-manager.mjs";

const { Client } = pg;

export function hashPasswordLocal(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

function safeCloseClient(client) {
  try {
    if (client) {
      client._ending = true;
      if (client.connection) {
        client.connection._ending = true;
        if (client.connection.stream) {
          client.connection.stream.destroy();
        }
      }
    }
  } catch {
    // ignore
  }
}

export async function runMigrationsAndSeed(projectRoot = process.cwd()) {
  const cfg = getDbConfig(projectRoot);
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    connectionTimeoutMillis: 5000,
  });
  client.on("error", () => {});

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
      );
    `);

    const migrationsDir = path.join(projectRoot, "db", "migrations");
    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      const { rows: appliedRows } = await client.query(
        "SELECT filename FROM public.schema_migrations"
      );
      const appliedSet = new Set(appliedRows.map((r) => r.filename));

      for (const file of files) {
        if (appliedSet.has(file)) continue;

        console.log(`[migrate] Applying migration ${file}...`);
        const sql = fs
          .readFileSync(path.join(migrationsDir, file), "utf8")
          .replace(/\uFEFF/g, "");
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query(
            "INSERT INTO public.schema_migrations (filename) VALUES ($1)",
            [file]
          );
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`Migration ${file} failed: ${err.message}`);
        }
      }
    }

    // One-time import from snapshot if businesses table is empty
    const snapshotPath = path.join(projectRoot, "db", "supabase-snapshot.json");
    if (fs.existsSync(snapshotPath)) {
      const { rows: bizCountRows } = await client.query(
        "SELECT COUNT(*)::int AS cnt FROM public.businesses"
      );
      if ((bizCountRows[0]?.cnt ?? 0) === 0) {
        console.log("[migrate] Importing initial snapshot into local PostgreSQL...");
        const dump = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
        const defaultPw =
          process.env.LOCAL_IMPORT_DEFAULT_PASSWORD || "pakistan123";
        const fallbackHash = hashPasswordLocal(defaultPw);

        await client.query("BEGIN");
        try {
          const { rows: colRows } = await client.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
          `);
          const tableColTypes = new Map();
          for (const r of colRows) {
            if (!tableColTypes.has(r.table_name)) {
              tableColTypes.set(r.table_name, new Map());
            }
            tableColTypes.get(r.table_name).set(r.column_name, r.data_type);
          }

          // 1. Insert auth_users + matching profiles first
          const profileMap = new Map();
          for (const p of dump.tables?.profiles || []) {
            profileMap.set(p.id, p);
          }

          for (const u of dump.authUsers || []) {
            const prof = profileMap.get(u.id);
            const fullName =
              u.full_name ||
              prof?.full_name ||
              u.user_metadata?.full_name ||
              (u.email ? u.email.split("@")[0] : "User");
            const hash = u.password_hash || fallbackHash;

            await client.query(
              `INSERT INTO public.auth_users (id, email, password_hash, full_name, phone, email_confirmed_at, created_at, updated_at)
               VALUES ($1, lower($2), $3, $4, $5, $6, COALESCE($7, now()), COALESCE($8, now()))
               ON CONFLICT (id) DO NOTHING`,
              [
                u.id,
                u.email || `${u.id}@local.technoworld`,
                hash,
                fullName,
                u.phone || prof?.phone || null,
                u.email_confirmed_at || new Date().toISOString(),
                u.created_at || new Date().toISOString(),
                u.updated_at || new Date().toISOString(),
              ]
            );

            await client.query(
              `INSERT INTO public.profiles (id, full_name, phone, email, avatar_url, status, created_at, updated_at)
               VALUES ($1, $2, $3, lower($4), $5, COALESCE($6, 'ACTIVE'), COALESCE($7, now()), COALESCE($8, now()))
               ON CONFLICT (id) DO NOTHING`,
              [
                u.id,
                fullName,
                prof?.phone || u.phone || null,
                prof?.email || u.email || null,
                prof?.avatar_url || null,
                prof?.status || "ACTIVE",
                prof?.created_at || u.created_at || new Date().toISOString(),
                prof?.updated_at || u.updated_at || new Date().toISOString(),
              ]
            );
          }

          // 2. Insert all other exported tables in safe dependency order
          const importOrder = [
            "businesses",
            "roles",
            "permissions",
            "role_permissions",
            "memberships",
            "terminals",
            "owners",
            "accounts",
            "financial_accounts",
            "expense_categories",
            "employees",
            "employee_compensation_history",
            "shifts",
            "cash_sessions",
            "shift_handovers",
            "categories",
            "products",
            "services",
            "suppliers",
            "customers",
            "inventory_categories",
            "inventory_items",
            "purchases",
            "purchase_items",
            "inventory_lots",
            "sales",
            "sale_items",
            "payments",
            "refunds",
            "refund_items",
            "stock_adjustments",
            "stock_movements",
            "customer_ledger",
            "expenses",
            "account_transfers",
            "account_movements",
            "cash_movements",
            "attendance",
            "leaves",
            "pos_print_papers",
            "pos_media_categories",
            "pos_composing_services",
            "daily_report_snapshots",
            "daily_closings",
            "saved_reports",
            "audit_logs",
            "business_settings",
            "receipt_settings",
            "printer_settings",
            "notification_settings",
          ];

          for (const tableName of importOrder) {
            const rows = dump.tables?.[tableName];
            if (!rows || rows.length === 0) continue;
            const colMap = tableColTypes.get(tableName);
            if (!colMap) continue;

            let inserted = 0;
            for (const row of rows) {
              const keys = Object.keys(row).filter((k) => colMap.has(k));
              if (keys.length === 0) continue;
              const vals = keys.map((k) => {
                const v = row[k];
                if (v === undefined) return null;
                const dt = colMap.get(k);
                if ((dt === "jsonb" || dt === "json") && v !== null) {
                  return JSON.stringify(v);
                }
                return v;
              });
              const colsSql = keys.map((k) => `"${k}"`).join(", ");
              const paramsSql = keys.map((_, i) => `$${i + 1}`).join(", ");
              await client.query(
                `INSERT INTO public."${tableName}" (${colsSql}) VALUES (${paramsSql}) ON CONFLICT DO NOTHING`,
                vals
              );
              inserted += 1;
            }
            console.log(`[migrate] Imported ${tableName}: ${inserted} rows`);
          }

          await client.query("COMMIT");
          console.log(
            `[migrate] Snapshot import complete! Default local password for migrated users: ${defaultPw} (change anytime in Settings).`
          );
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`Snapshot import failed: ${err.message}`);
        }
      }
    }
  } finally {
    safeCloseClient(client);
  }
}

// Allow direct CLI execution (`bun scripts/migrate.mjs`)
const invokedScript = (process.argv[1] || "").replace(/\\/g, "/");
if (invokedScript.endsWith("/migrate.mjs") || invokedScript === "migrate.mjs") {
  const { ensurePostgresRunning } = await import("./pg-manager.mjs");
  const pgHandle = await ensurePostgresRunning();
  try {
    await runMigrationsAndSeed();
  } finally {
    await pgHandle.stop();
  }
}
