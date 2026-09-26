/** One delivery window for storefront, desk, and saved replies. */
export const PROCESS_DAYS = 1;
export const TRANSIT_FLOOR = 7;
export const RANGE_SPAN = 8;

export function deliveryWindow(shippingDays?: number) {
  const transit = Math.max(TRANSIT_FLOOR, Math.round(shippingDays || TRANSIT_FLOOR));
  const low = PROCESS_DAYS + transit;
  const high = low + RANGE_SPAN;
  return {
    low,
    high,
    transit,
    text: `Delivers in ${low}–${high} days`,
    short: `${low}–${high} days`,
  };
}
