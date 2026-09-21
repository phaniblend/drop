/** Shorten wholesale titles into something a human would say in an ad. */
export function spokenProductName(raw: string) {
  let name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "this product";

  name = name
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\b(new|hot|sale|free shipping|dropshipping|wholesale)\b/gi, " ")
    .replace(/[|/·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cut = name.split(/[,(\-–—]/)[0]?.trim() || name;
  const words = cut.split(" ").filter(Boolean).slice(0, 6);
  const short = words.join(" ") || "this product";
  return short.length > 48 ? `${short.slice(0, 45).trim()}…` : short;
}
