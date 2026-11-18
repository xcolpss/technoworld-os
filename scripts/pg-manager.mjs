import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

export function loadEnvFile(projectRoot = process.cwd()) {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

export function getDbConfig(projectRoot = process.cwd()) {
  loadEnvFile(projectRoot);
  return {
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5433),
    database: process.env.PGDATABASE || "technoworld_os",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    dataDir: path.join(projectRoot, ".postgres-data"),
    backupDir: path.join(projectRoot, ".postgres-backups"),
    logFile: path.join(projectRoot, ".postgres-data.log"),
  };
}

export function resolvePostgresBinDir(projectRoot = process.cwd()) {
  if (process.env.PG_BIN_DIR && fs.existsSync(path.join(process.env.PG_BIN_DIR, "pg_ctl.exe"))) {
    return process.env.PG_BIN_DIR;
  }

  const bundled = path.join(
    projectRoot,
    "node_modules",
    "@embedded-postgres",
    "windows-x64",
    "native",
    "bin"
  );
  if (fs.existsSync(path.join(bundled, "pg_ctl.exe"))) {
    return bundled;
  }

  const programFilesPg = "C:\\Program Files\\PostgreSQL";
  if (fs.existsSync(programFilesPg)) {
    const versions = fs
      .readdirSync(programFilesPg)
      .sort((a, b) => Number(b) - Number(a));
    for (const ver of versions) {
      const candidate = path.join(programFilesPg, ver, "bin");
      if (fs.existsSync(path.join(candidate, "pg_ctl.exe"))) {
        return candidate;
      }
    }
  }

  throw new Error(
    "PostgreSQL binaries not found. Run `bun install` so @embedded-postgres/windows-x64 is available."
  );
}

export async function canConnectToPostgres(cfg, targetDb = "postgres") {
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    database: targetDb,
    user: cfg.user,
    password: cfg.password,
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return true;
  } catch {
    try {
      await client.end();
    } catch {
      // ignore
    }
    return false;
  }
}

function isPidAliveWindows(pid) {
  try {
    const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], {
      encoding: "utf8",
    });
    return out.includes(String(pid));
  } catch {
    return false;
  }
}

function cleanupStalePidIfDead(pgCtlExe, dataDir) {
  const pidFile = path.join(dataDir, "postmaster.pid");
  if (!fs.existsSync(pidFile)) return;
  const statusCheck = spawnSync(pgCtlExe, ["-D", dataDir, "status"], {
    encoding: "utf8",
  });
  if (statusCheck.status === 0) {
    // Server is actually running; no cleanup needed
    return;
  }
  const firstLine = fs.readFileSync(pidFile, "utf8").split(/\r?\n/)[0]?.trim();
  const pid = Number(firstLine);
  if (!Number.isFinite(pid) || pid <= 0 || !isPidAliveWindows(pid)) {
    console.log("[pg-manager] Removing stale postmaster.pid after unexpected shutdown...");
    fs.unlinkSync(pidFile);
  }
}

function writeClusterConfig(cfg) {
  const confPath = path.join(cfg.dataDir, "postgresql.conf");
  const existing = fs.existsSync(confPath) ? fs.readFileSync(confPath, "utf8") : "";
  const marker = "# --- TECHNOWORLD OS LOCAL TUNING ---";
  const tuningBlock = `
${marker}
listen_addresses = '${cfg.host}'
port = ${cfg.port}
max_connections = 60
shared_buffers = 128MB
work_mem = 8MB
synchronous_commit = on
fsync = on
logging_collector = off
timezone = 'UTC'
`;

  if (!existing.includes(marker)) {
    fs.writeFileSync(confPath, existing + "\n" + tuningBlock);
  } else {
    const cleaned = existing.split(marker)[0].trimEnd();
    fs.writeFileSync(confPath, cleaned + "\n" + tuningBlock);
  }
}

export async function ensurePostgresRunning(projectRoot = process.cwd()) {
  const cfg = getDbConfig(projectRoot);
  const binDir = resolvePostgresBinDir(projectRoot);
  const initdbExe = path.join(binDir, "initdb.exe");
  const pgCtlExe = path.join(binDir, "pg_ctl.exe");

  fs.mkdirSync(cfg.backupDir, { recursive: true });

  // 1. Initialize cluster cleanly on first run
  const pgVersionFile = path.join(cfg.dataDir, "PG_VERSION");
  if (!fs.existsSync(pgVersionFile)) {
    console.log("[pg-manager] Initializing persistent local PostgreSQL data cluster...");
    const pwFile = path.join(os.tmpdir(), `tw-initpw-${process.pid}.tmp`);
    fs.writeFileSync(pwFile, cfg.password, "utf8");
    try {
      execFileSync(
        initdbExe,
        [
          "-D",
          cfg.dataDir,
          "-U",
          cfg.user,
          "-E",
          "UTF8",
          "--locale=C",
          "--auth=scram-sha-256",
          `--pwfile=${pwFile}`,
        ],
        { stdio: "inherit" }
      );
    } finally {
      if (fs.existsSync(pwFile)) fs.unlinkSync(pwFile);
    }
    writeClusterConfig(cfg);
  } else {
    writeClusterConfig(cfg);
  }

  // 2. Check if already running and accepting connections
  let ready = await canConnectToPostgres(cfg, "postgres");
  let startedByUs = false;

  if (!ready) {
    cleanupStalePidIfDead(pgCtlExe, cfg.dataDir);
    // Double check after cleanup in case pg_ctl status confirmed it's finishing startup
    ready = await canConnectToPostgres(cfg, "postgres");
  }

  if (!ready) {
    console.log(`[pg-manager] Starting local PostgreSQL on ${cfg.host}:${cfg.port}...`);
    const startRes = spawnSync(
      pgCtlExe,
      ["-D", cfg.dataDir, "-l", cfg.logFile, "start", "-w", "-t", "30"],
      { encoding: "utf8" }
    );
    if (startRes.status !== 0) {
      throw new Error(
        `Failed to start local PostgreSQL:\n${startRes.stdout}\n${startRes.stderr}`
      );
    }
    startedByUs = true;

    for (let i = 0; i < 20; i++) {
      ready = await canConnectToPostgres(cfg, "postgres");
      if (ready) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!ready) {
      throw new Error("PostgreSQL started but did not accept TCP connections in time.");
    }
  } else {
    console.log(`[pg-manager] Local PostgreSQL already running on ${cfg.host}:${cfg.port}.`);
  }

  // 3. Ensure application database exists
  const adminClient = new Client({
    host: cfg.host,
    port: cfg.port,
    database: "postgres",
    user: cfg.user,
    password: cfg.password,
  });
  await adminClient.connect();
  try {
    const dbCheck = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [cfg.database]
    );
    if (dbCheck.rowCount === 0) {
      console.log(`[pg-manager] Creating database "${cfg.database}"...`);
      await adminClient.query(`CREATE DATABASE "${cfg.database}"`);
    }
  } finally {
    await adminClient.end();
  }

  return {
    cfg,
    binDir,
    startedByUs,
    stop: async () => {
      if (!startedByUs) return;
      console.log("[pg-manager] Stopping local PostgreSQL gracefully...");
      spawnSync(pgCtlExe, ["-D", cfg.dataDir, "stop", "-m", "fast", "-w", "-t", "15"], {
        stdio: "inherit",
      });
    },
  };
}
