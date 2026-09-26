/** Pure local listing-copy helpers (safe for unit tests — no server-only). */

const JUNK = [
  /\bwholesale\b/gi,
  /\bdropshipping\b/gi,
  /\bdropship\b/gi,
  /\bhot sale\b/gi,
  /\bnew 20\d{2}\b/gi,
  /\b20\d{2} new\b/gi,
  /\bfactory\b/gi,
  /\bfree shipping\b/gi,
  /\bready to ship\b/gi,
  /\bgarvee\b/gi,
  /\bcorrectpor\b/gi,
  /\b\d+x\d+\s*inch\b/gi,
  /\b\d+mah\b/gi,
];

function stripJunk(raw: string) {
  let next = raw;
  for (const re of JUNK) next = next.replace(re, " ");
  return next.replace(/[|/]+/g, " ").replace(/\s+/g, " ").trim();
}

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
  const cleanedCurrent = stripJunk(currentTitle ?? "");
  if (cleanedCurrent && cleanedCurrent.length >= 3 && cleanedCurrent.length <= 60) {
    const words = cleanedCurrent.split(/\s+/).filter(Boolean);
    if (words.length <= 8 && cleanedCurrent === (currentTitle ?? "").trim()) {
      return currentTitle!.trim();
    }
  }

  const next = stripJunk(raw);
  const spoken = spokenProductName(next || cleanedCurrent);
  if (spoken && spoken !== "this product") {
    return titleCaseWords(spoken.split(" "));
  }
  const words = (next || cleanedCurrent).split(" ").filter((w) => w.length > 1 && !/^\d+(\.\d+)?$/.test(w));
  return titleCaseWords(words.slice(0, 6)) || cleanedCurrent || "Product";
}

export function formatGeminiFallback(reason: string | null | undefined) {
  const r = (reason || "unknown error").trim();
  void r;
  return "Couldn’t refresh copy automatically; used a local suggestion";
}
