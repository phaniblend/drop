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
  { re: /\bdrop\s?ship/i, pts: 28, category: "Dropship intent" },
  { re: /\bshopify\b/i, pts: 18, category: "Beginner First Store Blocker" },
  { re: /\b(e-?com(?:merce)?|online store)\b/i, pts: 14, category: "Beginner First Store Blocker" },
  { re: /\b(ad spend|ads?|facebook ads|tiktok ads|meta ads)\b/i, pts: 16, category: "Ad Spend Loss" },
  { re: /\b(spent|burned|lost|losing)\b.{0,24}\b(\$\s?\d|\d+\s?dollars)/i, pts: 22, category: "Ad Spend Loss ($300+)" },
  { re: /\bno (free )?time\b|\b(50|60) hours\b|\btoo busy\b/i, pts: 14, category: "Time Blocker / Invited DM" },
  { re: /\b(failed|quit|ready to quit|can't convert|no sales)\b/i, pts: 12, category: "Ad Spend Loss" },
  { re: /\bdm (is )?open\b|\bany advice\b/i, pts: 8, category: "Time Blocker / Invited DM" },
];

export function scoreProspectText(text: string) {
  const body = text.trim();
  if (body.length < 40) return null;
  let score = 0;
  let category = "Operator intent";
  for (const rule of INTENT) {
    if (rule.re.test(body)) {
      score += rule.pts;
      category = rule.category;
    }
  }
  if (score < 18) return null;
  return { score: Math.min(99, 50 + score), category };
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
        subreddit?: string;
      };
    }>;
  };
};

const SUBS = ["dropship", "dropshipping", "shopify", "ecommerce", "sidehustle"];

async function redditJson(path: string) {
  const res = await fetch(`https://www.reddit.com${path}`, {
    headers: {
      "User-Agent": "SetoProfinder/1.0 (https://www.seto.store/profinder)",
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Reddit ${res.status}`);
  return (await res.json()) as RedditListing;
}

function permalinkUrl(permalink?: string) {
  if (!permalink) return "https://www.reddit.com";
  return `https://www.reddit.com${permalink}`;
}

export async function searchProfinderLeads(): Promise<{ leads: ProfinderLead[]; source: string; warning?: string }> {
  const seen = new Set<string>();
  const leads: ProfinderLead[] = [];
  const errors: string[] = [];

  await Promise.all(
    SUBS.map(async (sub) => {
      try {
        const [comments, posts] = await Promise.all([
          redditJson(`/r/${sub}/comments.json?limit=80&raw_json=1`),
          redditJson(`/r/${sub}/new.json?limit=40&raw_json=1`),
        ]);
        const rows = [...(comments.data?.children ?? []), ...(posts.data?.children ?? [])];
        for (const row of rows) {
          const d = row.data;
          if (!d?.author || d.author === "[deleted]") continue;
          const context = (d.body || [d.title, d.selftext].filter(Boolean).join(" — ")).trim();
          const scored = scoreProspectText(context);
          if (!scored) continue;
          const id = d.name || d.id || `${sub}-${d.author}-${context.slice(0, 24)}`;
          if (seen.has(id)) continue;
          seen.add(id);
          leads.push({
            id,
            platform: "REDDIT",
            handle: d.author,
            category: scored.category,
            score: scored.score,
            profileUrl: `https://www.reddit.com/user/${encodeURIComponent(d.author)}`,
            sourceUrl: permalinkUrl(d.permalink),
            context: context.slice(0, 500),
          });
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }),
  );

  leads.sort((a, b) => b.score - a.score);
  const top = leads.slice(0, 40);
  return {
    leads: top,
    source: "reddit",
    warning: top.length ? undefined : errors[0] || "No matching comments in the latest Reddit pull.",
  };
}
