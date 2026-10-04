/** Keep ad scripts pointing at the current sell price (not a stale baked-in number). */

export function formatSellPrice(price: number) {
  if (!(price > 0)) return "the price on screen";
  return `$${price.toFixed(2)}`;
}

export function withLivePrice(text: string, price: number) {
  const live = formatSellPrice(price);
  if (!(price > 0) || !text) return text;
  let next = text
    .replace(/\$\d+(?:\.\d{1,2})?/g, live)
    .replace(/\bat just\s+\d+(?:\.\d{1,2})?\b/gi, `at just ${live}`)
    .replace(/\bis\s+\d+\.\d{2}\b/gi, `is ${live}`)
    .replace(/\blive at\s+\d+(?:\.\d{1,2})?\b/gi, `live at ${live}`);
  // Fix "Belt. at just $X" → "Belt. At just $X"
  next = next.replace(/([.!?]\s+)([a-z])/g, (_, punct: string, letter: string) => punct + letter.toUpperCase());
  return next;
}
