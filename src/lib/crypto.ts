import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  const raw = (process.env.ENCRYPTION_KEY ?? "").trim();
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    /* fall through */
  }
  if (Buffer.byteLength(raw, "utf8") === 32) return Buffer.from(raw, "utf8");
  throw new Error("ENCRYPTION_KEY must be 32 bytes (utf8, hex, or base64).");
}

export function encryptSecret(plain: string) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(value: string) {
  if (!value.startsWith(PREFIX)) return value;
  const key = encryptionKey();
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Encrypted secret is malformed.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
