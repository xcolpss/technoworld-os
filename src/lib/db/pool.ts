import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var __twPgPool: Pool | undefined;
}

function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return {
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }

  return {
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5433),
    database: process.env.PGDATABASE || "technoworld_os",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

export function isLocalDbConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.PGDATABASE ||
      process.env.PGHOST ||
      true
  );
}

export function getDbPool(): Pool {
  if (!globalThis.__twPgPool) {
    globalThis.__twPgPool = new Pool(getPoolConfig());
  }
  return globalThis.__twPgPool;
}

export async function dbQuery<T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const pool = getDbPool();
  return pool.query<T>(sql, params);
}

export async function dbQueryOne<
  T extends QueryResultRow = Record<string, unknown>
>(sql: string, params: unknown[] = []): Promise<T | null> {
  const res = await dbQuery<T>(sql, params);
  return res.rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}
