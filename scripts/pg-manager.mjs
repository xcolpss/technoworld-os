import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const DEFAULT_ENV_CONTENT = `NEXT_PUBLIC_APP_NAME="TechnoWorld OS"
NEXT_PUBLIC_DEFAULT_CURRENCY="PKR"
NEXT_PUBLIC_DEFAULT_TIMEZONE="Asia/Karachi"

# Local Standalone PostgreSQL Configuration
PGHOST="127.0.0.1"
PGPORT="5433"
PGDATABASE="technoworld_os"
PGUSER="postgres"
PGPASSWORD="postgres"
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/technoworld_os"

# Cryptographic session signing secret (32+ chars)
AUTH_SESSION_SECRET="7fK9mQ2xV8nR4pL6zT1wY5cH0bJ3sD9aX6eG2uN8kF4vP1rC5mQ7yL0hB3tZ9wA"
LOCAL_IMPORT_DEFAULT_PASSWORD="pakistan123"
`;

export function ensureEnvFile(projectRoot = process.cwd()) {
  const envPath = path.join(projectRoot, ".env.local");
  const examplePath = path.join(projectRoot, ".env.example");
  const repoExamplePath = path.join(REPO_ROOT, ".env.example");

  if (!fs.existsSync(envPath)) {
    try {
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, envPath);
      } else if (fs.existsSync(repoExamplePath)) {
        fs.copyFileSync(repoExamplePath, envPath);
      } else {
        fs.writeFileSync(envPath, DEFAULT_ENV_CONTENT, "utf8");
      }
      console.log("[pg-manager] Auto-created .env.local for fresh installation.");
    } catch {
      // If directory is read-only or temporary, fall back to in-memory defaults
    }
  }
}

export function loadEnvFile(projectRoot = process.cwd()) {
  ensureEnvFile(projectRoot);
  const envPath = path.join(projectRoot, ".env.local");
  const raw = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : DEFAULT_ENV_CONTENT;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim().replace(/^['"]|['"]$/g, "");
    // Override host-machine global PGPORT=5432 if present so system Postgres never conflicts
    if (!process.env[key] || (key === "PGPORT" && process.env.PGPORT === "5432")) {
      process.env[key] = val;
    }
  }
}

export function getDbConfig(projectRoot = process.cwd()) {
  loadEnvFile(projectRoot);
  const host = process.env.PGHOST || "127.0.0.1";
  const port = Number(process.env.PGPORT || 5433);
  const database = process.env.PGDATABASE || "technoworld_os";
  const user = process.env.PGUSER || "postgres";
  const password = process.env.PGPASSWORD || "postgres";

  process.env.PGHOST = host;
  process.env.PGPORT = String(port);
  process.env.PGDATABASE = database;
  process.env.PGUSER = user;
  process.env.PGPASSWORD = password;
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;

  return {
    host,
    port,
    database,
    user,
    password,
    dataDir: path.join(projectRoot, ".postgres-data"),
    backupDir: path.join(projectRoot, ".postgres-backups"),
    logFile: path.join(projectRoot, ".postgres-data.log"),
  };
}

function ensureBundledRuntimeDlls(binDir, projectRoot = process.cwd()) {
  const requiredDlls = ["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll"];
  const candidateSources = [
    path.join(projectRoot, "scripts", "win64-runtime"),
    path.join(REPO_ROOT, "scripts", "win64-runtime"),
    "C:\\Windows\\System32",
  ];

  for (const dllName of requiredDlls) {
    const targetPath = path.join(binDir, dllName);
    if (fs.existsSync(targetPath)) continue;

    for (const srcDir of candidateSources) {
      const srcPath = path.join(srcDir, dllName);
      if (fs.existsSync(srcPath)) {
        try {
          fs.copyFileSync(srcPath, targetPath);
          break;
        } catch {
          // continue checking fallback source
        }
      }
    }
  }
}

export function resolvePostgresBinDir(projectRoot = process.cwd()) {
  const candidates = [];

  if (process.env.PG_BIN_DIR) {
    candidates.push(process.env.PG_BIN_DIR);
  }

  candidates.push(
    path.join(
      projectRoot,
      "node_modules",
      "@embedded-postgres",
      "windows-x64",
      "native",
      "bin"
    ),
    path.join(
      REPO_ROOT,
      "node_modules",
      "@embedded-postgres",
      "windows-x64",
      "native",
      "bin"
    )
  );

  const programFilesPg = "C:\\Program Files\\PostgreSQL";
  if (fs.existsSync(programFilesPg)) {
    try {
      const versions = fs
        .readdirSync(programFilesPg)
        .sort((a, b) => Number(b) - Number(a));
      for (const ver of versions) {
        candidates.push(path.join(programFilesPg, ver, "bin"));
      }
    } catch {
      // ignore permission errors on Program Files
    }
  }

  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, "pg_ctl.exe"))) {
      ensureBundledRuntimeDlls(dir, projectRoot);
      return dir;
    }
  }

  throw new Error(
    "PostgreSQL binaries not found. Run `bun install` so @embedded-postgres/windows-x64 is available."
  );
}

function buildCleanPgEnv(binDir, cfg) {
  const env = { ...process.env };
  // Strip any host-machine global PostgreSQL variables that could hijack initdb/pg_ctl/postgres
  for (const key of [
    "PGDATA",
    "PGSYSCONFDIR",
    "PGLOCALEDIR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGREALM",
    "PGSSLMODE",
    "PGREQUIRESSL",
  ]) {
    delete env[key];
  }
  env.PGHOST = cfg.host;
  env.PGPORT = String(cfg.port);
  env.PGUSER = cfg.user;
  env.PGPASSWORD = cfg.password;
  env.PGCONNECT_TIMEOUT = "5";
  env.LC_ALL = "C";
  env.LANG = "C";
  // Prepend binDir so bundled DLLs always take precedence over any system PATH DLLs
  const pathKey =
    Object.keys(env).find((k) => k.toUpperCase() === "PATH") || "PATH";
  env[pathKey] = `${binDir}${path.delimiter}${env[pathKey] || ""}`;
  return env;
}

export function isTcpPortOpen(host, port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

function forceDestroyClient(client) {
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

export async function canConnectToPostgres(cfg, targetDb = "postgres") {
  // Fast raw TCP check avoids constructing pg.Client when port isn't open yet
  const portOpen = await isTcpPortOpen(cfg.host, cfg.port, 400);
  if (!portOpen) return false;

  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    database: targetDb,
    user: cfg.user,
    password: cfg.password,
    connectionTimeoutMillis: 1500,
  });
  client.on("error", () => {
    // Prevent unhandled error event crashes during startup probes
  });

  let timer = null;
  try {
    const probe = (async () => {
      await client.connect();
      await client.query("SELECT 1");
      return true;
    })();
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("probe timeout")), 2000);
    });
    return await Promise.race([probe, timeout]);
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
    // Always destroy socket directly; never await client.end() on a failed connection
    forceDestroyClient(client);
  }
}

function writeClusterConfig(cfg) {
  const confPath = path.join(cfg.dataDir, "postgresql.conf");
  const existing = fs.existsSync(confPath)
    ? fs.readFileSync(confPath, "utf8")
    : "";
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
    fs.writeFileSync(confPath, existing + "\n" + tuningBlock, "utf8");
  } else {
    const cleaned = existing.split(marker)[0].trimEnd();
    fs.writeFileSync(confPath, cleaned + "\n" + tuningBlock, "utf8");
  }
}

function writePgHbaConfig(cfg) {
  const hbaPath = path.join(cfg.dataDir, "pg_hba.conf");
  if (!fs.existsSync(hbaPath)) return;
  const hbaContent = `# TechnoWorld OS Local Embedded PostgreSQL Authentication
# Server listens strictly on 127.0.0.1 (loopback only).
# Type  Database        User            Address                 Method
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
`;
  fs.writeFileSync(hbaPath, hbaContent, "utf8");
}

function cleanupStaleOrWedgedCluster(pgCtlExe, cfg, pgEnv) {
  const pidFile = path.join(cfg.dataDir, "postmaster.pid");
  if (!fs.existsSync(pidFile)) return;

  // Use stdio: "ignore" so no pipe handles can ever be inherited or block
  const statusCheck = spawnSync(pgCtlExe, ["-D", cfg.dataDir, "status"], {
    stdio: "ignore",
    windowsHide: true,
    env: pgEnv,
    timeout: 5000,
  });

  if (statusCheck.status === 0) {
    // A process is running for this dataDir, but canConnectToPostgres returned false (wedged or wrong port).
    console.log("[pg-manager] Stopping wedged local PostgreSQL instance...");
    spawnSync(
      pgCtlExe,
      ["-D", cfg.dataDir, "stop", "-m", "immediate", "-W"],
      {
        stdio: "ignore",
        windowsHide: true,
        env: pgEnv,
        timeout: 5000,
      }
    );
  }

  if (fs.existsSync(pidFile)) {
    try {
      console.log("[pg-manager] Removing stale postmaster.pid...");
      fs.rmSync(pidFile, { force: true });
    } catch {
      // ignore if locked
    }
  }
}

function readRecentLogTail(logFile, maxLines = 25) {
  if (!fs.existsSync(logFile)) return "(no log file created)";
  try {
    const raw = fs.readFileSync(logFile, "utf8");
    const lines = raw.trim().split(/\r?\n/);
    return lines.slice(-maxLines).join("\n");
  } catch {
    return "(unable to read log file)";
  }
}

async function launchPostgresDaemon({ binDir, pgCtlExe, cfg, pgEnv }) {
  const postgresExe = path.join(binDir, "postgres.exe");

  // Strategy 1: Launch via pg_ctl.exe with "-W" (no-wait) and stdio: "ignore".
  // Works in both standard user and elevated Administrator terminals (via CreateRestrictedProcess),
  // and stdio: "ignore" guarantees zero pipe handles are ever inherited by child processes.
  const ctlRes = spawnSync(
    pgCtlExe,
    ["-D", cfg.dataDir, "-l", cfg.logFile, "start", "-W"],
    {
      stdio: "ignore",
      windowsHide: true,
      env: pgEnv,
      timeout: 10000,
    }
  );

  if (ctlRes.status === 0) {
    return;
  }

  // Strategy 2 (Fallback if COMSPEC/cmd.exe is restricted on the host machine):
  // Spawn postgres.exe directly as a detached background process with file-descriptor logging.
  if (fs.existsSync(postgresExe)) {
    const logFd = fs.openSync(cfg.logFile, "a");
    const child = spawn(postgresExe, ["-D", cfg.dataDir], {
      cwd: cfg.dataDir,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      windowsHide: true,
      env: pgEnv,
    });
    child.Once?.("error", () => {});
    child.on("error", () => {});
    child.unref();
    try {
      fs.closeSync(logFd);
    } catch {
      // ignore
    }
  }
}

export async function ensurePostgresRunning(projectRoot = process.cwd()) {
  const cfg = getDbConfig(projectRoot);
  const binDir = resolvePostgresBinDir(projectRoot);
  const initdbExe = path.join(binDir, "initdb.exe");
  const pgCtlExe = path.join(binDir, "pg_ctl.exe");
  const pgEnv = buildCleanPgEnv(binDir, cfg);

  fs.mkdirSync(cfg.backupDir, { recursive: true });

  // 1. Initialize cluster cleanly on first run (or if a previous init was interrupted/corrupted)
  const pgVersionFile = path.join(cfg.dataDir, "PG_VERSION");
  const pgControlFile = path.join(cfg.dataDir, "global", "pg_control");
  if (!fs.existsSync(pgVersionFile) || !fs.existsSync(pgControlFile)) {
    if (fs.existsSync(cfg.dataDir)) {
      console.log("[pg-manager] Cleaning up incomplete .postgres-data directory before initialization...");
      fs.rmSync(cfg.dataDir, { recursive: true, force: true });
    }

    console.log("[pg-manager] Initializing persistent local PostgreSQL data cluster...");
    const pwFile = path.join(projectRoot, `.postgres-initpw-${process.pid}.tmp`);
    fs.writeFileSync(pwFile, cfg.password, "utf8");
    try {
      const initRes = spawnSync(
        initdbExe,
        [
          "-D",
          cfg.dataDir,
          "-U",
          cfg.user,
          "-E",
          "UTF8",
          "--locale=C",
          "--no-locale",
          "--auth=trust",
          `--pwfile=${pwFile}`,
          "--no-instructions",
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          encoding: "utf8",
          windowsHide: true,
          env: pgEnv,
          timeout: 60000,
        }
      );

      if (initRes.status !== 0) {
        throw new Error(
          `initdb failed (exit ${initRes.status}):\n${initRes.stdout || ""}\n${initRes.stderr || ""}`
        );
      }
    } finally {
      if (fs.existsSync(pwFile)) {
        try {
          fs.rmSync(pwFile, { force: true });
        } catch {
          // ignore
        }
      }
    }
  }

  writeClusterConfig(cfg);
  writePgHbaConfig(cfg);

  // 2. Check if already running and accepting connections
  const pidFile = path.join(cfg.dataDir, "postmaster.pid");
  let portInUse = await isTcpPortOpen(cfg.host, cfg.port, 150);
  let ready = portInUse ? await canConnectToPostgres(cfg, "postgres") : false;
  let startedByUs = false;

  if (!ready && fs.existsSync(pidFile)) {
    cleanupStaleOrWedgedCluster(pgCtlExe, cfg, pgEnv);
    portInUse = await isTcpPortOpen(cfg.host, cfg.port, 150);
    ready = portInUse ? await canConnectToPostgres(cfg, "postgres") : false;
  }

  if (!ready) {
    // If another unrelated service on the host machine is occupying port 5433, find a free port automatically
    if (portInUse) {
      for (let candidatePort = cfg.port + 1; candidatePort <= cfg.port + 15; candidatePort++) {
        if (!(await isTcpPortOpen(cfg.host, candidatePort, 150))) {
          console.log(
            `[pg-manager] Port ${cfg.port} is in use by another application; switching embedded PostgreSQL to port ${candidatePort}.`
          );
          cfg.port = candidatePort;
          process.env.PGPORT = String(candidatePort);
          process.env.DATABASE_URL = `postgresql://${encodeURIComponent(cfg.user)}:${encodeURIComponent(cfg.password)}@${cfg.host}:${cfg.port}/${encodeURIComponent(cfg.database)}`;
          pgEnv.PGPORT = String(candidatePort);
          writeClusterConfig(cfg);
          break;
        }
      }
    }

    console.log(`[pg-manager] Starting local PostgreSQL on ${cfg.host}:${cfg.port}...`);
    await launchPostgresDaemon({ binDir, pgCtlExe, cfg, pgEnv });
    startedByUs = true;

    for (let i = 0; i < 60; i++) {
      ready = await canConnectToPostgres(cfg, "postgres");
      if (ready) break;
      await new Promise((r) => setTimeout(r, 120));
    }

    if (!ready) {
      const logTail = readRecentLogTail(cfg.logFile, 25);
      throw new Error(
        `PostgreSQL started but did not accept TCP connections on ${cfg.host}:${cfg.port} in time.\nRecent log output:\n${logTail}`
      );
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
    connectionTimeoutMillis: 5000,
  });
  adminClient.on("error", () => {});
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
    forceDestroyClient(adminClient);
  }

  return {
    cfg,
    binDir,
    startedByUs,
    stop: async () => {
      if (!startedByUs) return;
      console.log("[pg-manager] Stopping local PostgreSQL gracefully...");
      spawnSync(
        pgCtlExe,
        ["-D", cfg.dataDir, "stop", "-m", "fast", "-w", "-t", "10"],
        {
          stdio: "ignore",
          windowsHide: true,
          env: pgEnv,
          timeout: 12000,
        }
      );
    },
  };
}

// Allow direct invocation (`bun scripts/pg-manager.mjs --setup-only`) during postinstall
if (process.argv.includes("--setup-only")) {
  ensureEnvFile(process.cwd());
  try {
    resolvePostgresBinDir(process.cwd());
  } catch {
    // Ignore if optional platform binary is not yet extracted
  }
}
