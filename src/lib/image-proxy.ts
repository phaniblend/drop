const ALLOWED = /(^|\.)alicdn\.com$|(^|\.)aliexpress\.com$|(^|\.)aliexpress-media\.com$|(^|\.)cjdropshipping\.com$/i;

export function isSupplierCdn(url: string) {
  try {
    return ALLOWED.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Serve AliExpress/CJ photos from our origin so the grid is not blank and the supplier URL stays hidden. */
export function proxiedImageUrl(src?: string | null) {
  const raw = String(src ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("/api/media?")) return raw;
  if (!isSupplierCdn(raw)) return raw;
  return `/api/media?u=${encodeURIComponent(raw)}`;
}
