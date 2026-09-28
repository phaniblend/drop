const BLOCKED =
  /\b(omega\s*3|fish oil|dietary supplement|cbd|thc|cannabis|vape|e-?cig|weapon|firearm|ammunition|viagra|cialis)\b/i;

const REVIEW =
  /\b(jessup|scoliosis|pain relief|medical device|cure|treats?|alleviate|fda approved|prescription)\b/i;

const LICENSED =
  /\b(hello kitty|kuromi|my melody|cinnamoroll|sanrio|disney|marvel|pokemon|nintendo|nike|adidas|gucci|louis vuitton|supreme|off-white|licensed)\b/i;

export function licensedBrandWarning(title?: string, description?: string) {
  const text = `${title ?? ""} ${description ?? ""}`;
  if (!LICENSED.test(text)) return null;
  return "Brand-name or licensed item — Meta and Stripe can suspend a store that lists this.";
}

export function screenListing(input: { title?: string; description?: string }) {
  const text = `${input.title ?? ""} ${input.description ?? ""}`;
  if (BLOCKED.test(text)) {
    return {
      ok: false as const,
      level: "block" as const,
      reason: "Supplements, controlled, or restricted goods cannot be published.",
    };
  }
  const licensed = licensedBrandWarning(input.title, input.description);
  if (licensed) {
    return { ok: false as const, level: "review" as const, reason: licensed };
  }
  if (REVIEW.test(text)) {
    return {
      ok: false as const,
      level: "review" as const,
      reason: "This listing looks like a health claim. Confirm it is allowed before publishing.",
    };
  }
  return { ok: true as const };
}

export const MIN_PUBLISH_PRICE = 14.99;
