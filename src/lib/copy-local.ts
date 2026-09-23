/** Pure local listing-copy helpers (safe for unit tests — no server-only). */

const JUNK = [
  /\bwholesale\b/gi,
  /\bdropshipping\b/gi,
  /\bdropship\b/gi,
  /\bhot sale\b/gi,
  /\bnew 20\d{2}\b/gi,
  /\bfactory\b/gi,
  /\bfree shipping\b/gi,
  /\bready to ship\b/gi,
  /\bgarvee\b/gi,
];

function titleCaseWords(words: string[]) {
  return words
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function localCleanTitle(
  raw: string,
  currentTitle: string | undefined,
  spokenProductName: (raw: string) => string,
) {
  const current = currentTitle?.trim();
  if (current && current.length >= 3 && current.length <= 60) {
    const words = current.split(/\s+/).filter(Boolean);
    if (words.length <= 8) return current;
  }

  let next = raw;
  for (const re of JUNK) next = next.replace(re, " ");
  next = next.replace(/[|/]+/g, " ").replace(/\s+/g, " ").trim();
  const spoken = spokenProductName(next);
  if (spoken && spoken !== "this product") {
    return titleCaseWords(spoken.split(" "));
  }
  const words = next.split(" ").filter((w) => w.length > 1 && !/^\d+(\.\d+)?$/.test(w));
  return titleCaseWords(words.slice(0, 6)) || current || "Product";
}

export function formatGeminiFallback(reason: string | null | undefined) {
  const r = (reason || "unknown error").trim();
  // Operator-facing copy stays vendor-neutral; reason is logged server-side.
  void r;
  return "Couldn’t refresh copy automatically; used a local suggestion";
}
