import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

describe("crypto", () => {
  it("round-trips AES-256-GCM secrets", () => {
    process.env.ENCRYPTION_KEY = "a".repeat(32);
    const enc = encryptSecret("shpua_offline_token");
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(enc)).toBe("shpua_offline_token");
  });
});
