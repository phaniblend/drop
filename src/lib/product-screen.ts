const BLOCKED =
  /\b(omega\s*3|fish oil|dietary supplement|cbd|thc|cannabis|vape|e-?cig|weapon|firearm|ammunition|viagra|cialis)\b/i;

const REVIEW =
  /\b(jessup|scoliosis|pain relief|medical device|cure|treats?|alleviate|fda approved|prescription)\b/i;

export function screenListing(input: { title?: string; description?: string }) {
  const text = `${input.title ?? ""} ${input.description ?? ""}`;
  if (BLOCKED.test(text)) {
    return {
      ok: false as const,
      level: "block" as const,
      reason: "Supplements, controlled, or restricted goods cannot be published.",
    };
  }
  if (REVIEW.test(text)) {
    return {
      ok: false as const,
      level: "review" as const,
      reason: "This listing looks like a health claim or brand name. Confirm it is allowed before publishing.",
    };
  }
  return { ok: true as const };
}

export const MIN_PUBLISH_PRICE = 14.99;
