export type ProfinderLead = {
  id: string;
  platform: "REDDIT";
  handle: string;
  category: string;
  score: number;
  profileUrl: string;
  sourceUrl: string;
  context: string;
};

const INTENT = [
  { re: /\bdrop\s?ship(?:ping)?\b/i, pts: 28, category: "Dropship intent" },
  { re: /\bshopify\b/i, pts: 18, category: "Beginner First Store Blocker" },
  { re: /\b(e-?com(?:merce)?|online store)\b/i, pts: 14, category: "Beginner First Store Blocker" },
  { re: /\b(tiktok shop|amazon fba|print on demand)\b|\bpod\b/i, pts: 16, category: "Channel seller" },
  { re: /\b(side ?hustle|side ?gig|extra income|passive income)\b/i, pts: 12, category: "Side gig hunter" },
  { re: /\b(ad spend|facebook ads|tiktok ads|meta ads|\bads?\b)\b/i, pts: 16, category: "Ad Spend Loss" },
  { re: /\b(spent|burned|lost|losing)\b.{0,24}\b(\$\s?\d|\d+\s?dollars)/i, pts: 22, category: "Ad Spend Loss ($300+)" },
  { re: /\bno (free )?time\b|\b(50|60) hours\b|\btoo busy\b/i, pts: 14, category: "Time Blocker / Invited DM" },
  { re: /\b(failed|quit|ready to quit|can't convert|no sales)\b/i, pts: 12, category: "Ad Spend Loss" },
  { re: /\bdm (is )?open\b|\bany advice\b/i, pts: 8, category: "Time Blocker / Invited DM" },
];

export function scoreProspectText(text: string) {
  const body = text.trim();
  if (body.length < 32) return null;
  let score = 0;
  let category = "Operator intent";
  for (const rule of INTENT) {
    if (rule.re.test(body)) {
      score += rule.pts;
      category = rule.category;
    }
  }
  if (score < 12) return null;
  return { score: Math.min(99, 48 + score), category };
}

type PullpushRow = {
  id?: string;
  author?: string;
  body?: string;
  selftext?: string;
  title?: string;
  permalink?: string;
};

const PULLS: Array<{ q: string; subreddit?: string }> = [
  { q: "dropship" },
  { q: "dropshipping" },
  { q: "shopify store" },
  { q: "tiktok shop" },
  { q: "amazon fba" },
  { q: "side hustle", subreddit: "sidehustle" },
  { q: "side gig" },
  { q: "dropship", subreddit: "dropship" },
  { q: "shopify", subreddit: "shopify" },
  { q: "ecommerce", subreddit: "ecommerce" },
  { q: "print on demand" },
  { q: "extra income store" },
];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function permalinkUrl(permalink?: string) {
  if (!permalink) return "https://www.reddit.com";
  if (permalink.startsWith("http")) return permalink;
  return `https://www.reddit.com${permalink.startsWith("/") ? "" : "/"}${permalink}`;
}

function pushLead(
  leads: ProfinderLead[],
  seen: Set<string>,
  blocked: { ids: Set<string>; handles: Set<string> },
  row: PullpushRow,
) {
  const handle = (row.author || "").trim();
  if (!handle || handle === "[deleted]" || handle === "AutoModerator") return;
  if (blocked.handles.has(handle.toLowerCase())) return;
  const context = (row.body || [row.title, row.selftext].filter(Boolean).join(" — ")).trim();
  const scored = scoreProspectText(context);
  if (!scored) return;
  const id = row.id ? `t1_${row.id.replace(/^t[13]_/, "")}` : `${handle}-${context.slice(0, 20)}`;
  if (blocked.ids.has(id) || seen.has(id)) return;
  seen.add(id);
  leads.push({
    id,
    platform: "REDDIT",
    handle,
    category: scored.category,
    score: scored.score,
    profileUrl: `https://www.reddit.com/user/${encodeURIComponent(handle)}`,
    sourceUrl: permalinkUrl(row.permalink),
    context: context.slice(0, 500),
  });
}

async function pullpushComments(q: string, subreddit?: string) {
  const params = new URLSearchParams({ q, size: "100", sort: "desc", sort_type: "created_utc" });
  if (subreddit) params.set("subreddit", subreddit);
  const res = await fetch(`https://api.pullpush.io/reddit/search/comment/?${params}`, {
    headers: { Accept: "application/json", "User-Agent": BROWSER_UA },
  });
  if (!res.ok) throw new Error(`Archive ${res.status}`);
  const json = (await res.json()) as { data?: PullpushRow[] };
  return Array.isArray(json.data) ? json.data : [];
}

async function pullpushSubmissions(q: string, subreddit?: string) {
  const params = new URLSearchParams({ q, size: "50", sort: "desc", sort_type: "created_utc" });
  if (subreddit) params.set("subreddit", subreddit);
  const res = await fetch(`https://api.pullpush.io/reddit/search/submission/?${params}`, {
    headers: { Accept: "application/json", "User-Agent": BROWSER_UA },
  });
  if (!res.ok) throw new Error(`Archive ${res.status}`);
  const json = (await res.json()) as { data?: PullpushRow[] };
  return Array.isArray(json.data) ? json.data : [];
}

type RedditListing = {
  data?: {
    children?: Array<{
      data?: {
        id?: string;
        name?: string;
        author?: string;
        body?: string;
        selftext?: string;
        title?: string;
        permalink?: string;
      };
    }>;
  };
};

async function tryOfficialReddit(blocked: { ids: Set<string>; handles: Set<string> }) {
  const leads: ProfinderLead[] = [];
  const seen = new Set<string>();
  const subs = ["dropship", "dropshipping", "shopify", "ecommerce", "sidehustle", "entrepreneur"];
  for (const sub of subs) {
    try {
      const res = await fetch(`https://old.reddit.com/r/${sub}/comments.json?limit=100&raw_json=1`, {
        headers: { Accept: "application/json", "User-Agent": BROWSER_UA },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as RedditListing;
      for (const child of json.data?.children ?? []) {
        const d = child.data;
        if (!d) continue;
        pushLead(leads, seen, blocked, {
          id: d.name || d.id,
          author: d.author,
          body: d.body,
          title: d.title,
          selftext: d.selftext,
          permalink: d.permalink,
        });
      }
    } catch {
      /* Railway IPs often get 403 */
    }
  }
  return leads;
}

export async function searchProfinderLeads(): Promise<{
  leads: ProfinderLead[];
  source: string;
  warning?: string;
}> {
  const { listProfinderContacted } = await import("./profinder-contacted");
  const blocked = await listProfinderContacted();
  const leads: ProfinderLead[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  const official = await tryOfficialReddit(blocked);
  for (const lead of official) {
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    leads.push(lead);
  }

  for (const pull of PULLS) {
    try {
      const [comments, posts] = await Promise.all([
        pullpushComments(pull.q, pull.subreddit),
        pullpushSubmissions(pull.q, pull.subreddit),
      ]);
      for (const row of [...comments, ...posts]) pushLead(leads, seen, blocked, row);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  leads.sort((a, b) => b.score - a.score);
  const top = leads.slice(0, 80);
  return {
    leads: top,
    source: official.length ? "reddit+archive" : "archive",
    warning: top.length
      ? undefined
      : errors[0] || "No matching uncontacted comments in this pull.",
  };
}
