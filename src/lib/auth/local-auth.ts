import crypto from "node:crypto";
import { dbQuery, dbQueryOne, withTransaction } from "@/lib/db/pool";
import {
  EPHEMERAL_SESSION_DB_SECONDS,
  PERSISTENT_SESSION_SECONDS,
  type PersistenceMode,
} from "@/lib/auth/cookie-persistence";

function getSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    "tw-local-os-session-secret-key-2026-technoworld-rawalpindi"
  );
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const [, salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, "hex");
  if (derived.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expectedBuf);
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function signSessionToken(rawToken: string): string {
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(rawToken)
    .digest("hex");
  return `${rawToken}.${sig}`;
}

export function extractVerifiedRawToken(signedValue?: string | null): string | null {
  if (!signedValue) return null;
  const dotIdx = signedValue.lastIndexOf(".");
  if (dotIdx <= 0) return null;
  const rawToken = signedValue.slice(0, dotIdx);
  const sigHex = signedValue.slice(dotIdx + 1);
  if (!rawToken || sigHex.length !== 64) return null;

  const expectedHex = crypto
    .createHmac("sha256", getSessionSecret())
    .update(rawToken)
    .digest("hex");

  const sigBuf = Buffer.from(sigHex, "hex");
  const expBuf = Buffer.from(expectedHex, "hex");
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  return rawToken;
}

export async function createLocalAuthSession(
  userId: string,
  mode: PersistenceMode
): Promise<{ signedToken: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const ttlSeconds =
    mode === "persistent"
      ? PERSISTENT_SESSION_SECONDS
      : EPHEMERAL_SESSION_DB_SECONDS;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  // Clean up expired sessions for this user and insert new active session
  await dbQuery(
    `DELETE FROM public.auth_sessions WHERE user_id = $1 AND expires_at <= now()`,
    [userId]
  );

  await dbQuery(
    `INSERT INTO public.auth_sessions (user_id, token_hash, persistence_mode, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, mode, expiresAt.toISOString()]
  );

  return {
    signedToken: signSessionToken(rawToken),
    expiresAt,
  };
}

export async function revokeLocalAuthSession(
  signedCookieValue?: string | null
): Promise<void> {
  const rawToken = extractVerifiedRawToken(signedCookieValue);
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  await dbQuery(`DELETE FROM public.auth_sessions WHERE token_hash = $1`, [
    tokenHash,
  ]);
}

export async function updateSessionPersistenceInDb(
  signedCookieValue: string | null | undefined,
  mode: PersistenceMode
): Promise<void> {
  const rawToken = extractVerifiedRawToken(signedCookieValue);
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  const ttlSeconds =
    mode === "persistent"
      ? PERSISTENT_SESSION_SECONDS
      : EPHEMERAL_SESSION_DB_SECONDS;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await dbQuery(
    `UPDATE public.auth_sessions SET persistence_mode = $1, expires_at = $2 WHERE token_hash = $3`,
    [mode, expiresAt.toISOString(), tokenHash]
  );
}

export async function verifyUserCredentials(
  email: string,
  password: string
): Promise<{ id: string; email: string; fullName: string } | null> {
  const cleanEmail = email.trim().toLowerCase();
  const user = await dbQueryOne<{
    id: string;
    email: string;
    password_hash: string;
    full_name: string | null;
  }>(
    `SELECT id, email, password_hash, full_name FROM public.auth_users WHERE lower(email) = $1 LIMIT 1`,
    [cleanEmail]
  );

  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;

  await dbQuery(
    `UPDATE public.auth_users SET last_sign_in_at = now(), updated_at = now() WHERE id = $1`,
    [user.id]
  );

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name || user.email.split("@")[0] || "Shop User",
  };
}

export async function createLocalUserAccount(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ id: string; email: string; fullName: string }> {
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanName = input.fullName.trim() || cleanEmail.split("@")[0];
  const hash = hashPassword(input.password);

  return withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM public.auth_users WHERE lower(email) = $1 LIMIT 1`,
      [cleanEmail]
    );
    if ((existing.rowCount ?? 0) > 0) {
      throw new Error("An account with this email already exists.");
    }

    const userRes = await client.query<{ id: string }>(
      `INSERT INTO public.auth_users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [cleanEmail, hash, cleanName]
    );
    const userId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO public.profiles (id, full_name, email, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
      [userId, cleanName, cleanEmail]
    );

    return { id: userId, email: cleanEmail, fullName: cleanName };
  });
}

export async function changeLocalUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await dbQueryOne<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM public.auth_users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  if (!user) throw new Error("User account not found.");
  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw new Error("Current password is incorrect.");
  }
  const newHash = hashPassword(newPassword);
  await dbQuery(
    `UPDATE public.auth_users SET password_hash = $1, updated_at = now() WHERE id = $2`,
    [newHash, userId]
  );
}
