import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

// AES-256-GCM for secrets we must store (LinkedIn tokens, users' API keys).
// Format: v1.<iv>.<tag>.<ciphertext>, all base64url.

function key(): Buffer {
  return createHash("sha256").update(env.encryptionKey()).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decrypt(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown encrypted value format.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

// Short, readable one-time codes (no 0/O/1/I confusion).
export function shortCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(length), (b) => alphabet[b % alphabet.length]).join("");
}

// Tamper-proof, expiring token: base64url(json).hmac
export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 })).toString("base64url");
  const mac = createHash("sha256").update(`${env.encryptionKey()}.${body}`).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHash("sha256").update(`${env.encryptionKey()}.${body}`).digest("base64url");
  if (expected.length !== mac.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
  return data.exp > Date.now() ? data : null;
}

export function maskSecret(value: string): string {
  return value.length <= 8 ? "••••" : `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
