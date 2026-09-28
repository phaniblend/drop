/** One clean mailing label for AliExpress / CJ paste — never mix two street lines. */

const STREET_RE = /\b(st|street|ave|avenue|rd|road|blvd|ln|lane|dr|drive|ct|court|way|pl|place|hwy|pkwy)\b/i;

export function looksLikeStreetLine(value: string) {
  const text = value.trim();
  return Boolean(text) && /\d/.test(text) && STREET_RE.test(text);
}

export function fulfillmentCardTitle(orderNumber: string, customerName: string) {
  const name = customerName.trim();
  if (!name || looksLikeStreetLine(name)) return orderNumber;
  return `${orderNumber} · ${name}`;
}

export function normalizeAddressLines(raw: string): string[] {
  const parts = raw
    .split(/[\n|;]+/)
    .flatMap((chunk) => chunk.split(","))
    .map((part) => part.replace(/\s+/g, " ").replace(/\.$/, "").trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase().replace(/[.]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique;
}

/** Clipboard text: customer name (if it is a name) + one normalized address. */
export function mailingLabel(customerName: string, shippingAddress: string) {
  const name = customerName.trim();
  const who = name && !looksLikeStreetLine(name) ? name : "";
  const address = normalizeAddressLines(shippingAddress).join(", ");
  return [who, address].filter(Boolean).join("\n");
}
