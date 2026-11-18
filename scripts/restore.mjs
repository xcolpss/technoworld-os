import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { ensurePostgresRunning, getDbConfig } from "./pg-manager.mjs";

const { Client } = pg;

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

export async function restoreDatabaseBackup(backupFileArg, projectRoot = process.cwd()) {
  const cfg = getDbConfig(projectRoot);
  if (!fs.existsSync(cfg.backupDir)) {
    throw new Error("No .postgres-backups directory exists yet.");
  }

  const targetFile = backupFileArg
    ? path.resolve(projectRoot, backupFileArg)
    : (() => {
        const latest = fs
          .readdirSync(cfg.backupDir)
          .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
          .sort()
          .reverse()[0];
        return latest ? path.join(cfg.backupDir, latest) : null;
      })();

  if (!targetFile || !fs.existsSync(targetFile)) {
    throw new Error("No backup file found to restore.");
  }

  const payload = JSON.parse(fs.readFileSync(targetFile, "utf8"));
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
    await client.query("BEGIN");
    await client.query("SET LOCAL session_replication_role = 'replica'");

    const tableNames = Object.keys(payload.tables || {});
    if (tableNames.length > 0) {
      const quoted = tableNames.map((t) => `public."${t}"`).join(", ");
      await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
    }

    for (const [tableName, rows] of Object.entries(payload.tables || {})) {
      if (!rows || rows.length === 0) continue;
      for (const row of rows) {
        const keys = Object.keys(row);
        const vals = keys.map((k) => {
          const v = row[k];
          if (v !== null && typeof v === "object" && !(v instanceof Date)) {
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
      }
    }

    await client.query("COMMIT");
    console.log(`[restore] Successfully restored database from ${targetFile}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    safeCloseClient(client);
  }
}

const invokedScript = (process.argv[1] || "").replace(/\\/g, "/");
if (invokedScript.endsWith("/restore.mjs") || invokedScript === "restore.mjs") {
  const pgHandle = await ensurePostgresRunning();
  try {
    await restoreDatabaseBackup(process.argv[2]);
  } finally {
    await pgHandle.stop();
  }
}
