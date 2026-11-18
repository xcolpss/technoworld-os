import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { ensurePostgresRunning, getDbConfig } from "./pg-manager.mjs";

const { Client } = pg;

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
  });

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
    await client.end();
  }
}

if (process.argv[1]?.endsWith("backup.mjs")) {
  const pgHandle = await ensurePostgresRunning();
  await createDatabaseBackup(process.cwd());
  await pgHandle.stop();
}
