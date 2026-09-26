export const MAX_STORE_LINE_QTY = 20;

export function validateStoreQty(qty: unknown, stock: number):
  | { ok: true; qty: number }
  | { ok: false; error: string } {
  if (!Number.isInteger(qty) || Number(qty) < 1) {
    return { ok: false, error: "Choose a whole number of 1 or more." };
  }
  const n = Number(qty);
  if (stock <= 0) return { ok: false, error: "That option is sold out." };
  if (n > stock) return { ok: false, error: `Only ${stock} left.` };
  if (n > MAX_STORE_LINE_QTY) {
    return { ok: false, error: `You can buy at most ${MAX_STORE_LINE_QTY} of this item.` };
  }
  return { ok: true, qty: n };
}
