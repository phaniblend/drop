export type StoreCartLine = {
  productId: string;
  variantId: string;
  qty: number;
};

const LEGACY_KEY = "seto-store-cart";

export function storeCartKey(storeId?: string | null) {
  const id = (storeId ?? "").trim();
  return id ? `${LEGACY_KEY}:${id}` : LEGACY_KEY;
}

export function readStoreCart(storeId?: string | null): StoreCartLine[] {
  if (typeof window === "undefined") return [];
  const key = storeCartKey(storeId);
  try {
    const raw = window.localStorage.getItem(key) ?? (key !== LEGACY_KEY ? null : window.localStorage.getItem(LEGACY_KEY));
    const parsed = raw ? (JSON.parse(raw) as StoreCartLine[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((line) => line.productId && line.variantId && line.qty > 0)
      : [];
  } catch {
    return [];
  }
}

export function writeStoreCart(lines: StoreCartLine[], storeId?: string | null) {
  window.localStorage.setItem(storeCartKey(storeId), JSON.stringify(lines));
  window.dispatchEvent(new Event("seto-cart"));
}

export function addStoreCartLine(line: StoreCartLine, storeId?: string | null) {
  const current = readStoreCart(storeId);
  const match = current.find(
    (item) => item.productId === line.productId && item.variantId === line.variantId,
  );
  if (match) match.qty += line.qty;
  else current.push(line);
  writeStoreCart(current, storeId);
}

export function clearStoreCart(storeId?: string | null) {
  writeStoreCart([], storeId);
}

export function cartCount(lines: StoreCartLine[]) {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}
