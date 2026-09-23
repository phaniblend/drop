/** Normalize ad-script lines for display and clipboard (no array join commas). */
export function formatScript(lines: string[] | string): string {
  const parts = (Array.isArray(lines) ? lines : [String(lines ?? "")])
    .flatMap((chunk) => String(chunk).split(/\n+/))
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.join(" ");
}

/** Coerce Gemini hook.script (string | string[]) into a single display string. */
export function normalizeHookScript(script: unknown): string {
  if (Array.isArray(script)) return formatScript(script.map((s) => String(s)));
  if (typeof script === "string") return formatScript(script);
  if (script == null) return "";
  return formatScript(String(script));
}
