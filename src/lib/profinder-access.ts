import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { canOpenProfinder } from "./profinder-allow";

export { canOpenProfinder };
export const PROFINDER_COOKIE = "seto_profinder";
export const PROFINDER_PASSWORD_DEFAULT = "findseto";

export function profinderPassword() {
  return (process.env.PROFINDER_PASSWORD?.trim() || PROFINDER_PASSWORD_DEFAULT).slice(0, 32);
}

function authSecret() {
  return process.env.AUTH_SECRET?.trim() || "dev-only-set-AUTH-SECRET";
}

export function profinderCookieValue(email: string) {
  return createHmac("sha256", authSecret())
    .update(`profinder:${email.trim().toLowerCase()}`)
    .digest("hex");
}

export function profinderCookieValid(email: string, cookie: string | undefined) {
  const expected = profinderCookieValue(email);
  const got = (cookie ?? "").trim();
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  } catch {
    return false;
  }
}

export function passwordsMatch(input: string) {
  const expected = profinderPassword();
  const got = input.trim();
  if (!got || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  } catch {
    return false;
  }
}
