/** Pure local listing-copy helpers (safe for unit tests — no server-only). */

const JUNK = [
  /\bwholesale\b/gi,
  /\bdropshipping\b/gi,
  /\bdropship\b/gi,
  /\bhot sale\b/gi,
  /\bhot selling(?:\s+items?)?\b/gi,
  /\btop rated(?:\s+20\d{2})?\b/gi,
  /\blocal stock\b/gi,
  /\bnew 20\d{2}\b/gi,
  /\b20\d{2} new\b/gi,
  /\b20\d{2}\b/g,
  /\bfactory\b/gi,
  /\bfree shipping\b/gi,
  /\bready to ship\b/gi,
  /\bgarvee\b/gi,
  /\bcorrectpor\b/gi,
  /\b\d+x\d+\s*inch\b/gi,
];

const TRAILING_STOP =
  /\b(for|with|and|or|the|a|an|of|to|in|on|by|from|at|as|\d+)\s*$/i;

function stripJunk(raw: string) {
  let next = raw;
  for (const re of JUNK) next = next.replace(re, " ");
  next = next.replace(/[|/]+/g, " ").replace(/\s+/g, " ").trim();
  // Normalise common tokens after strip.
  next = next
    .replace(/\busb\b/gi, "USB")
    .replace(/\b(\d+)\s*mah\b/gi, "$1mAh")
    .replace(/\bpc\b/gi, "PC");
  return next;
}

/** Short card title: word-boundary truncate, no dangling preposition/number. */
export function discoverCardTitle(raw: string, maxWords = 8) {
  const cleaned = stripJunk(raw);
  let words = cleaned.split(/\s+/).filter(Boolean).slice(0, maxWords);
  while (words.length > 2 && TRAILING_STOP.test(words[words.length - 1] || "")) {
    words = words.slice(0, -1);
  }
  return titleCaseWords(words) || cleaned || "Product";
}

function titleCaseWords(words: string[]) {
  return words
    .filter(Boolean)
    .map((w) => {
      if (/^usb$/i.test(w)) return "USB";
      if (/^(\d+)mah$/i.test(w)) return w.replace(/mah$/i, "mAh");
      if (/^pc$/i.test(w)) return "PC";
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
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
