/** Hardcoded operators with full desk access and no plan limits. */
export const SUPERUSER_EMAILS = ["bsit.setty@gmail.com"] as const;

export function isSuperuser(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (SUPERUSER_EMAILS as readonly string[]).includes(normalized);
}
