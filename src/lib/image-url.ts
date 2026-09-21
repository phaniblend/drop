/** Normalize supplier CDN image URLs for display (protocol-relative → https). */
export function absoluteImageUrl(src: string | null | undefined): string {
  const trimmed = String(src ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
      .replace(/\\u002F/gi, "/")
      .replace(/_\d+x\d+\.(jpg|jpeg|png|webp)$/i, ".$1");
  }
  return "";
}
