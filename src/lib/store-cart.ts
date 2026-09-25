export type StoreCartLine = {
  productId: string;
  variantId: string;
  qty: number;
};

const KEY = "seto-store-cart";

export function readStoreCart(): StoreCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as StoreCartLine[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((line) => line.productId && line.variantId && line.qty > 0)
      : [];
  } catch {
    return [];
  }
}

export function writeStoreCart(lines: StoreCartLine[]) {
  window.localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event("seto-cart"));
}

export function addStoreCartLine(line: StoreCartLine) {
  const current = readStoreCart();
  const match = current.find(
    (item) => item.productId === line.productId && item.variantId === line.variantId,
  );
  if (match) match.qty += line.qty;
  else current.push(line);
  writeStoreCart(current);
}

export function clearStoreCart() {
  writeStoreCart([]);
}

export function cartCount(lines = readStoreCart()) {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}
