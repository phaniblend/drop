const ITEM_PATH = /\/(?:item|i)\/\d+/i;
const HOST = /(?:^|\.)aliexpress\.(?:com|us|ru|es|fr|de|it|nl|pl|pt|ja|kr|id|vn|ph|th|co\.kr)(?:$|:)/i;

export function isAliExpressItemUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!HOST.test(url.hostname)) return false;
    return ITEM_PATH.test(url.pathname) || /\/item\/[^/]+/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function canonicalAliExpressUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.hash = "";
  const match = url.pathname.match(/\/(?:item|i)\/([^/?#]+)/i);
  if (match) {
    url.pathname = `/item/${match[1]}`;
  }
  url.search = "";
  return url.toString();
}
