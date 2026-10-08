/** Shared fulfillment field checks — used by actions and the order editor. */

export const MIN_SUPPLIER_ORDER_ID_LEN = 3;
export const MIN_TRACKING_LEN = 6;

export function validateSupplierOrderId(raw: string, opts?: { practice?: boolean }) {
  const value = raw.trim();
  if (!value) {
    return { ok: false as const, error: "Enter the supplier order id before marking placed." };
  }
  // Practice smoke orders may use a short placeholder; live orders need a real id.
  if (!opts?.practice && value.length < MIN_SUPPLIER_ORDER_ID_LEN) {
    return { ok: false as const, error: "Enter the supplier order id before marking placed." };
  }
  if (!opts?.practice && /^SUP-\d+$/i.test(value)) {
    return {
      ok: false as const,
      error: "Paste the real supplier order id — do not use an auto-generated SUP- placeholder.",
    };
  }
  return { ok: true as const, value };
}

export function validateTracking(trackingRaw: string, carrierRaw: string) {
  const tracking = trackingRaw.trim();
  const carrier = carrierRaw.trim();
  if (tracking.length < MIN_TRACKING_LEN) {
    return {
      ok: false as const,
      error: "That doesn't look like a tracking number — check it and try again.",
    };
  }
  if (!carrier) {
    return { ok: false as const, error: "Pick or enter a carrier before saving tracking." };
  }
  return { ok: true as const, tracking, carrier };
}
