/** Shorten wholesale titles into something a human would say in an ad. */
const STRIP = [
  /\b20\d{2}\b/g,
  /\b(new|hot|sale|free shipping|dropshipping|wholesale|ready to ship|factory|oem|odm)\b/gi,
  /\b(garvee|generic|unbranded|no brand)\b/gi,
  /\b\d+(\.\d+)?\s?(x|×)\s?\d+(\.\d+)?\s?(inch|in|ft|cm|mm)?\b/gi,
  /\b\d+(\.\d+)?\s?(inch|inches|in|ft|feet|cm|mm)\b/gi,
  /\b(pcs|pack|set of \d+|lot)\b/gi,
  /[|/·]+/g,
];

const PRODUCT_NOUNS =
  /\b(rug|mat|carpet|fan|lamp|light|sign|holder|organizer|case|kit|bracelet|watch|camera|bag|pillow|cover|stand|charger|cable|brush|cleaner|speaker|headset|mouse|keyboard|bottle|tumbler|mug|towel|socks|gloves|mask|cream|serum|trimmer|razor|blender|mixer|grill|pan|knife|board|shelf|rack|hook|clip|mount|tripod|drone|toy|puzzle|game|chair|desk|table|cushion|blanket|curtain|shade|filter|pump|hose|valve|sensor|tracker|scale|thermometer|mirror|comb|dryer|iron|steamer|vacuum|mop|broom|bucket|basket|bin|box|bag|wallet|belt|hat|cap|scarf|jacket|shirt|dress|shoe|sneaker|boot)\b/i;

export function spokenProductName(raw: string) {
  let name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "this product";

  for (const re of STRIP) name = name.replace(re, " ");
  name = name.replace(/\s+/g, " ").trim();

  const nounMatch = name.match(PRODUCT_NOUNS);
  if (nounMatch) {
    const idx = name.toLowerCase().indexOf(nounMatch[0].toLowerCase());
    const before = name.slice(0, idx).trim().split(/\s+/).filter(Boolean).slice(-2);
    const after = name
      .slice(idx)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3);
    const short = [...before, ...after].join(" ").trim();
    if (short.length >= 3) return short.length > 40 ? `${short.slice(0, 37).trim()}…` : short;
  }

  const cut = name.split(/[,(\-–—]/)[0]?.trim() || name;
  const words = cut
    .split(" ")
    .filter((w) => w.length > 1 && !/^\d+$/.test(w))
    .slice(0, 5);
  const short = words.join(" ") || "this product";
  return short.length > 40 ? `${short.slice(0, 37).trim()}…` : short;
}

/** Pull benefit-ish phrases from title/description for ad and listing copy. */
export function extractProductBeats(input: {
  title: string;
  description?: string;
  niche?: string;
}): string[] {
  const blob = `${input.title} ${input.description ?? ""}`.toLowerCase();
  const beats: string[] = [];

  const rules: Array<[RegExp, string]> = [
    [/washable|machine wash/i, "machine-washable so it stays clean without a special trip"],
    [/non[- ]?slip|anti[- ]?slip|grip/i, "non-slip grip that stays put on hard floors"],
    [/portable|foldable|collapsible/i, "packs small enough to throw in a bag"],
    [/rechargeable|usb|battery/i, "recharges instead of eating through disposables"],
    [/waterproof|water[- ]?resistant/i, "handles splashes without dying on you"],
    [/led|light up|illuminat/i, "lights up so you can actually see it at night"],
    [/adjustable|3[- ]speed|multi[- ]speed/i, "adjusts so one size fits more situations"],
    [/quiet|silent|noise/i, "runs quiet enough for a desk or bedroom"],
    [/fast charg|quick charg/i, "charges fast so you are not babysitting a cable"],
    [/organic|natural/i, "leans natural instead of a chemical smell"],
    [/christmas|xmas|holiday/i, "reads festive without looking cheap on camera"],
    [/outdoor|camping|travel/i, "built for travel and outdoor use"],
    [/waist|wearable|clip[- ]on/i, "hands-free so you can keep moving"],
  ];

  for (const [re, beat] of rules) {
    if (re.test(blob) && !beats.includes(beat)) beats.push(beat);
    if (beats.length >= 4) break;
  }

  if (beats.length < 2) {
    beats.push("a small daily annoyance solved without another expensive gadget");
  }
  if (beats.length < 3) {
    beats.push(
      input.niche && input.niche !== "general"
        ? `fits ${input.niche} shoppers who already know the problem`
        : "looks clean on camera for short-form ads",
    );
  }
  if (beats.length < 4) {
    beats.push("priced so ads still leave room after fees and shipping");
  }

  return beats.slice(0, 4);
}
