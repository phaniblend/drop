export function suggestStoreSlug(storeName: string, email: string) {
  const fromName = storeName.replace(/setostore/i, "").trim();
  const raw = fromName || email.split("@")[0] || "shop";
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || "shop";
}

export function storeHomePath(slug?: string | null) {
  const value = (slug || "").trim();
  if (!value || value === "seto") return "/store";
  return `/s/${value}`;
}
