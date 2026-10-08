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
  /\bmulti[- ]?functional\b/gi,
  /\b\d+x\d+\s*inch\b/gi,
];

const TRAILING_STOP =
  /\b(for|with|and|or|the|a|an|of|to|in|on|by|from|at|as|\d+)\s*$/i;

/** Tokens that are digit+letters mash or no-vowel junk at the start of a title. */
function isJunkToken(token: string) {
  const t = token.trim();
  if (!t) return true;
  if (/^\d+(?:mah|ml|w|v|oz|pcs?|-?pack|x\d*)$/i.test(t)) return false;
  if (/^\d+[a-z]/i.test(t)) return true;
  if (/^[a-z]*\d+[a-z]+$/i.test(t) && t.length <= 12 && !/[aeiou]/i.test(t.replace(/\d/g, ""))) return true;
  return false;
}

function stripJunk(raw: string) {
  let next = raw;
  // Keep capacity pairs like 500/1300ml as "500-1300ml" before slash strip.
  next = next.replace(/(\d+)\s*\/\s*(\d+\s*ml)\b/gi, "$1-$2");
  // Keep pack counts: "2 Pack" / "2 PCS" / "2x" → one token so the digit isn't dropped.
  next = next.replace(/\b(\d+)\s*[x×]\s*(\d+)?\b/gi, (_, a, b) => (b ? `${a}x${b}` : `${a}x`));
  next = next.replace(/\b(\d+)\s*(pcs?|pack)\b/gi, "$1$2");
  for (const re of JUNK) next = next.replace(re, " ");
  next = next.replace(/[,|/]+/g, " ").replace(/\s+/g, " ").trim();
  // Drop digit junk glued onto a real product noun (8oportable) — never eat mAh/W units.
  next = next.replace(
    /\b\d+(?!mah\b|ml\b|w\b|v\b|oz\b|pcs?\b|pack\b|x\b)[a-z]{0,4}(?=(portable|blender|juicer|fan|light|brush|belt|bag|cup|bottle)\b)/gi,
    "",
  );
  next = next
    .split(/\s+/)
    .flatMap((w) => {
      // 8000mahUsb → keep capacity, drop glue into next word
      const capacityGlued = w.match(/^(\d+(?:mah|ml|w|v|oz|pcs?|pack))([A-Za-z].+)$/i);
      if (capacityGlued) return [capacityGlued[1]!, capacityGlued[2]!];
      const glued = w.match(/^(\d+[a-z]+)([A-Z].+)$/);
      if (glued && !/^\d+(?:mah|ml|w|v|oz|pcs?|pack)$/i.test(glued[1]!)) return [glued[2]!];
      return [w];
    })
    .filter((w) => w && !isJunkToken(w) && !/^\d+$/.test(w))
    .join(" ");
  next = next
    .replace(/\busb\b/gi, "USB")
    .replace(/\bled\b/gi, "LED")
    .replace(/\b(\d+)\s*mah\b/gi, "$1mAh")
    .replace(/\b(\d+)pcs?\b/gi, "$1pcs")
    .replace(/\b(\d+)pack\b/gi, "$1-Pack")
    .replace(/\bpc\b/gi, "PC");
  return next.replace(/\s+/g, " ").trim();
}

function dedupeWords(words: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const key = w.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

const LEADING_STOP = /^(for|with|in|on|the|a|an|of|to|and|or|by|from|at|as)$/i;

/** Short card title: word-boundary truncate, no dangling preposition/number. */
export function discoverCardTitle(raw: string, maxWords = 8) {
  const cleaned = stripJunk(raw);
  let words = dedupeWords(cleaned.split(/\s+/).filter(Boolean)).slice(0, maxWords);
  while (words.length > 2 && LEADING_STOP.test(words[0] || "")) {
    words = words.slice(1);
  }
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
      if (/^led$/i.test(w)) return "LED";
      if (/^(\d+)mah$/i.test(w)) return w.replace(/mah$/i, "mAh");
      if (/^(\d+)-(\d+)ml$/i.test(w)) {
        return w.replace(/ml$/i, "ml");
      }
      if (/^pc$/i.test(w)) return "PC";
      if (/^[A-Z0-9]{2,}$/.test(w) && w === w.toUpperCase()) return w;
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
    const alreadyClean =
      words.length <= 8 &&
      cleanedCurrent === (currentTitle ?? "").trim() &&
      !/\b(20\d{2}|hot selling|top rated|local stock|wholesale|usb hanging|mah usb)\b/i.test(
        currentTitle ?? "",
      ) &&
      !/[a-z][A-Z]/.test(currentTitle ?? "") &&
      !isJunkToken(words[0] || "");
    if (alreadyClean) {
      return titleCaseWords(words);
    }
  }

  const next = stripJunk(raw);
  const spoken = spokenProductName(next || cleanedCurrent);
  if (spoken && spoken !== "this product") {
    return titleCaseWords(spoken.split(" "));
  }
  const words = dedupeWords(
    (next || cleanedCurrent).split(" ").filter((w) => w.length > 1 && !/^\d+(\.\d+)?$/.test(w)),
  );
  // Keep enough words that capacity + product type survive (e.g. 8000mAh USB Hanging Neck Fan).
  return titleCaseWords(words.slice(0, 10)) || cleanedCurrent || "Product";
}

export function formatGeminiFallback(reason: string | null | undefined) {
  const r = (reason || "unknown error").trim();
  void r;
  return "Couldn’t refresh copy automatically; used a local suggestion";
}
