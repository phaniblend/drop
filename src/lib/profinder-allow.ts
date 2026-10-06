import { isSuperuser } from "./superuser";

export const PROFINDER_EMAILS = ["dhanraydbs@gmail.com"] as const;

export function canOpenProfinder(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() || "";
  if (!normalized) return false;
  if (isSuperuser(normalized)) return true;
  return (PROFINDER_EMAILS as readonly string[]).includes(normalized);
}
