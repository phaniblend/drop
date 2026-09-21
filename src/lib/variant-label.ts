export function humanizeVariantLabel(raw: string) {
  const value = raw?.trim() || "";
  if (!value || value === "Default") return "Default";
  const parts = value
    .split(";")
    .map((segment) => {
      const hash = segment.indexOf("#");
      if (hash >= 0) {
        return segment
          .slice(hash + 1)
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
      if (/^\d+:\d+$/.test(segment.trim())) return "";
      const named = segment.match(/^([A-Za-z][\w\s/-]*):\s*(.+)$/);
      if (named) return `${named[1]}: ${named[2].trim()}`;
      if (/^[A-Za-z]/.test(segment) && !/^\d+:/.test(segment)) return segment.trim();
      const last = segment.split(":").pop()?.trim() ?? "";
      if (last && /[A-Za-z]/.test(last) && last.length < 48) {
        return last.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
      }
      return "";
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : "Option";
}
