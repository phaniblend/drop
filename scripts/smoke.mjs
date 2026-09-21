const DEFAULT_QUERIES = ["neck fan", "posture brace", "phone stand"];

function queryWords(query) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
}

function titleMatches(title, words) {
  const hay = title.toLowerCase();
  const hits = words.filter((word) => hay.includes(word)).length;
  return words.length === 1 ? hits === 1 : hits >= Math.ceil(words.length * 0.6);
}

function collectHtmlListings(html) {
  const found = new Map();
  const patterns = [
    /"productId"\s*:\s*"?(\d{10,})"?[\s\S]{0,1400}?"(?:displayTitle|productTitle)"\s*:\s*"((?:\\.|[^"\\])+)"/gi,
    /"productId"\s*:\s*"?(\d{10,})"?[\s\S]{0,800}?"title"\s*:\s*"((?:\\.|[^"\\])+)"/gi,
    /\/item\/(\d{10,})\.html[\s\S]{0,1800}?alt="([^"]{8,200})"/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const id = match[1];
      const title = (match[2] ?? "").replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      );
      if (!id || found.has(id) || title.length < 8) continue;
      found.set(id, { id, title, cost: 0 });
    }
  }
  for (const [id, item] of found) {
    const idx = html.indexOf(id);
    const window = idx >= 0 ? html.slice(Math.max(0, idx - 120), idx + 2400) : "";
    const price = window.match(/"salePrice"\s*:\s*"?([\d.]+)/i)?.[1]
      || window.match(/"minPrice"\s*:\s*"?([\d.]+)/i)?.[1];
    if (price) item.cost = Number.parseFloat(price);
  }
  return [...found.values()];
}

async function checkHtml(query) {
  const slug = query.trim().replace(/\s+/g, "-");
  const res = await fetch(`https://www.aliexpress.com/w/wholesale-${encodeURIComponent(slug)}.html`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const html = await res.text();
  const words = queryWords(query);
  const items = collectHtmlListings(html);
  const matched = items.filter((item) => titleMatches(item.title, words));
  const priced = matched.filter((item) => item.cost > 0);
  const ok = matched.length >= 3;
  console.log(`${ok ? "ok" : "fail"} html "${query}": ${matched.length} matched, ${priced.length} priced`);
  return ok;
}

async function checkLive() {
  const base = process.env.SMOKE_BASE_URL;
  const secret = process.env.SMOKE_SECRET;
  if (!base || !secret) {
    console.log("skip live desk check (set SMOKE_BASE_URL and SMOKE_SECRET)");
    return true;
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/api/health/discover`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const json = await res.json();
  console.log(`${json.ok ? "ok" : "fail"} live desk`, JSON.stringify(json.results ?? json));
  return Boolean(json.ok);
}

const htmlOk = (await Promise.all(DEFAULT_QUERIES.map(checkHtml))).every(Boolean);
const liveOk = await checkLive();
if (!htmlOk || !liveOk) process.exit(1);
console.log("smoke passed");
