import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ensurePostgresRunning } from "./pg-manager.mjs";
import { runMigrationsAndSeed } from "./migrate.mjs";
import { createDatabaseBackup } from "./backup.mjs";

const projectRoot = process.cwd();

async function main() {
  const nextBuildIdPath = path.join(projectRoot, ".next", "BUILD_ID");
  if (!fs.existsSync(nextBuildIdPath)) {
    console.error("[start] Production build missing (.next/BUILD_ID not found). Run `bun run build` first.");
    process.exit(1);
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

  const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  // Next.js 16 production Turbopack server runtime requires Node.js (avoid Bun CommonJS runtime bug)
  const runtimeBin =
    path.basename(process.execPath).toLowerCase().startsWith("node")
      ? process.execPath
      : "node";

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
