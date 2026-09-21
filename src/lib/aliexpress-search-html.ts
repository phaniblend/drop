const STOP = new Set(["the", "and", "for", "with", "from", "that", "this"]);

export type HtmlListing = {
  product_id: string;
  product_title: string;
  target_sale_price?: string | number;
  product_main_image_url?: string;
  lastest_volume?: string | number;
};

export function queryWords(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

export function titleMatches(title: string, words: string[]) {
  const hay = title.toLowerCase();
  if (!words.length) return false;
  const hits = words.filter((word) => hay.includes(word)).length;
  if (words.length === 1) return hits === 1;
  return hits >= Math.ceil(words.length * 0.6);
}

export function decodeAliTitle(raw: string) {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .trim();
}

function isProductTitle(title: string) {
  if (title.length < 8) return false;
  return !/dollar express|aliexpress|^search$|^log in$|^sign in$/i.test(title);
}

function firstNumber(chunk: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = chunk.match(pattern);
    const value = match?.[1];
    if (value && Number.parseFloat(value) > 0) return value;
  }
  return undefined;
}

export function extractPriceFromChunk(chunk: string) {
  return firstNumber(chunk, [
    /"salePrice"\s*:\s*"?([\d.]+)/i,
    /"minPrice"\s*:\s*"?([\d.]+)/i,
    /"skuAmount"[^}]{0,80}"value"\s*:\s*"?([\d.]+)/i,
    /"targetSalePrice"\s*:\s*"?([\d.]+)/i,
    /"formattedPrice"\s*:\s*"(?:US\s*)?\$?([\d.]+)/i,
    /"price"\s*:\s*"([\d.]+)"/,
  ]);
}

export function extractImageFromChunk(chunk: string) {
  const match = chunk.match(
    /"(?:imageUrl|imgUrl|productMainImageUrl|image)"\s*:\s*"(https?:[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
  );
  return match?.[1]?.replace(/\\u002F/gi, "/");
}

export function collectHtmlListings(html: string): HtmlListing[] {
  const found = new Map<string, HtmlListing>();
  const patterns = [
    /"productId"\s*:\s*"?(\d{10,})"?[\s\S]{0,1400}?"(?:displayTitle|productTitle)"\s*:\s*"((?:\\.|[^"\\])+)"/gi,
    /"productId"\s*:\s*"?(\d{10,})"?[\s\S]{0,800}?"title"\s*:\s*"((?:\\.|[^"\\])+)"/gi,
    /\/item\/(\d{10,})\.html[\s\S]{0,1800}?alt="([^"]{8,200})"/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const id = match[1];
      const title = decodeAliTitle(match[2] ?? "");
      if (!id || found.has(id) || !isProductTitle(title)) continue;
      found.set(id, { product_id: id, product_title: title });
    }
  }

  for (const [id, item] of found) {
    const idx = html.indexOf(id);
    const window = idx >= 0 ? html.slice(Math.max(0, idx - 120), idx + 2400) : "";
    const price = extractPriceFromChunk(window);
    const image = extractImageFromChunk(window);
    if (price) item.target_sale_price = price;
    if (image) item.product_main_image_url = image;
  }

  return [...found.values()];
}

export function evaluateDiscoverHealth(
  query: string,
  items: Array<{ title: string; cost: number }>,
) {
  const words = queryWords(query);
  const matched = items.filter((item) => titleMatches(item.title, words));
  const priced = matched.filter((item) => item.cost > 0);
  return {
    ok: matched.length >= 3 && priced.length >= 3,
    count: items.length,
    matched: matched.length,
    priced: priced.length,
  };
}
