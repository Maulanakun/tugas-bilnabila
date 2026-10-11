/* Kripto tanpa dependensi: hash sandi (scrypt) + token login (HMAC-SHA256). */
import { scrypt as _scrypt, randomBytes, timingSafeEqual, createHmac, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt);
const OPT = { N: 16384, r: 8, p: 1 };

export async function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(pw, salt, 32, OPT);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(pw, stored) {
  const [kind, salt, hex] = String(stored || "").split("$");
  if (kind !== "scrypt" || !salt || !hex) return false;
  const key = await scrypt(pw, salt, 32, OPT);
  const a = Buffer.from(hex, "hex");
  return a.length === key.length && timingSafeEqual(a, key);
}

export const newId = () => Date.now().toString(36) + randomBytes(5).toString("hex");

/* Sidik jari hash sandi: dipasang di token supaya token lama mati saat sandi diganti */
export const fingerprint = (stored) => createHash("sha256").update(String(stored)).digest("hex").slice(0, 12);

export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token, secret) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", secret).update(body).digest();
  let got;
  try { got = Buffer.from(sig, "base64url"); } catch { return null; }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p || typeof p.exp !== "number" || p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}

/* Bandingkan dua string tanpa bocor panjang/waktu */
export function safeEqual(a, b) {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}
