import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ensureEnvFile, ensurePostgresRunning } from "./pg-manager.mjs";
import { runMigrationsAndSeed } from "./migrate.mjs";
import { createDatabaseBackup } from "./backup.mjs";

const projectRoot = process.cwd();

function resolveNodeOrBunRuntime() {
  if (path.basename(process.execPath).toLowerCase().startsWith("node")) {
    return process.execPath;
  }
  const nodeCheck = spawnSync("node", ["-v"], {
    stdio: "ignore",
    windowsHide: true,
    timeout: 3000,
  });
  if (nodeCheck.status === 0) {
    return "node";
  }
  return process.execPath;
}

async function main() {
  ensureEnvFile(projectRoot);

  const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  const runtimeBin = resolveNodeOrBunRuntime();

  const nextBuildIdPath = path.join(projectRoot, ".next", "BUILD_ID");
  if (!fs.existsSync(nextBuildIdPath)) {
    console.log("[start] Production build (.next/BUILD_ID) not found. Running `next build` automatically...");
    const buildRes = spawnSync(runtimeBin, [nextBin, "build"], {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    });
    if (buildRes.status !== 0) {
      console.error("[start] Automatic `next build` failed.");
      process.exit(buildRes.status ?? 1);
    }
  }

  console.log("[start] 1/4 Ensuring local PostgreSQL service is installed and running...");
  const pgHandle = await ensurePostgresRunning(projectRoot);

  console.log("[start] 2/4 Running database migrations & initial snapshot check...");
  await runMigrationsAndSeed(projectRoot);

  console.log("[start] 3/4 Checking daily local backup...");
  try {
    await createDatabaseBackup(projectRoot, { autoOnly: true });
  } catch (err) {
    console.warn("[start] Auto-backup skipped:", err instanceof Error ? err.message : err);
  }

  const port = process.env.PORT || "3000";
  console.log(`[start] 4/4 Launching TechnoWorld OS Next.js server at http://localhost:${port} ...`);

  const child = spawn(runtimeBin, [nextBin, "start", "-p", port], {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: port,
    },
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[start] Received ${signal}. Shutting down cleanly...`);
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
    await pgHandle.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  child.on("exit", async (code) => {
    await pgHandle.stop();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[start] Startup failed:", err);
  process.exit(1);
});
