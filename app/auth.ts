import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export const SESSION_COOKIE = "bereke_session";
export const SESSION_AGE = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

export async function hashPassword(password: string, salt = base64(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromBase64(salt), iterations: 210000, hash: "SHA-256" }, key, 256);
  return `pbkdf2:210000:${salt}:${base64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterations, salt, digest] = stored.split(":");
  if (algorithm !== "pbkdf2" || iterations !== "210000" || !salt || !digest) return false;
  const candidate = await hashPassword(password, salt);
  const a = encoder.encode(candidate);
  const b = encoder.encode(stored);
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

export async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(userId: string) {
  const token = base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  await getDb().insert(sessions).values({ tokenHash: await tokenHash(token), userId, expiresAt: Date.now() + SESSION_AGE * 1000 });
  return token;
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    const [row] = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, await tokenHash(token)), gt(sessions.expiresAt, Date.now()))).limit(1);
    if (row) return { userId: row.id, displayName: row.name, email: row.email, provider: "local" as const };
  }
  const platformUser = await getChatGPTUser();
  return platformUser ? { ...platformUser, provider: "platform" as const } : null;
}
