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

export async function createDatabaseBackup(projectRoot = process.cwd(), { autoOnly = false } = {}) {
  const cfg = getDbConfig(projectRoot);
  fs.mkdirSync(cfg.backupDir, { recursive: true });

  const todayPrefix = new Date().toISOString().slice(0, 10);
  if (autoOnly) {
    const existingToday = fs
      .readdirSync(cfg.backupDir)
      .some((f) => f.startsWith(`backup-${todayPrefix}`) && f.endsWith(".json"));
    if (existingToday) return null;
  }

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
    const { rows: tableRows } = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
      ORDER BY tablename ASC
    `);

    const backupPayload = {
      createdAt: new Date().toISOString(),
      database: cfg.database,
      tables: {},
    };

    for (const { tablename } of tableRows) {
      const { rows } = await client.query(`SELECT * FROM public."${tablename}"`);
      backupPayload.tables[tablename] = rows;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outPath = path.join(cfg.backupDir, `backup-${stamp}.json`);
    fs.writeFileSync(outPath, JSON.stringify(backupPayload, null, 2));

    // Keep latest 30 backups cleanly
    const allBackups = fs
      .readdirSync(cfg.backupDir)
      .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
      .sort()
      .reverse();
    for (const stale of allBackups.slice(30)) {
      fs.unlinkSync(path.join(cfg.backupDir, stale));
    }

    console.log(`[backup] Saved local database backup: ${outPath}`);
    return outPath;
  } finally {
    safeCloseClient(client);
  }
}

const invokedScript = (process.argv[1] || "").replace(/\\/g, "/");
if (invokedScript.endsWith("/backup.mjs") || invokedScript === "backup.mjs") {
  const pgHandle = await ensurePostgresRunning();
  try {
    await createDatabaseBackup(process.cwd());
  } finally {
    await pgHandle.stop();
  }
}
