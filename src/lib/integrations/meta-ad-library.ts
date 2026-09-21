import "server-only";

import { env } from "../env";

const GRAPH = "https://graph.facebook.com/v20.0/ads_archive";

export type CompetitorAd = {
  id: string;
  pageName: string;
  body: string;
  title: string;
  startTime: string | null;
  stopTime: string | null;
  daysActive: number;
  proven: boolean;
  snapshotUrl: string | null;
};

function daysBetween(start: string | null, stop: string | null) {
  if (!start) return 0;
  const from = Date.parse(start);
  const to = stop ? Date.parse(stop) : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function demoAds(query: string): CompetitorAd[] {
  const q = query.trim() || "this product";
  return [
    {
      id: "demo_win",
      pageName: "Northline Home",
      body: `Still running the same ${q} creative after 6 weeks — comment “link”.`,
      title: `${q} restock`,
      startTime: new Date(Date.now() - 42 * 86_400_000).toISOString(),
      stopTime: null,
      daysActive: 42,
      proven: true,
      snapshotUrl: "https://www.facebook.com/ads/library",
    },
    {
      id: "demo_fresh",
      pageName: "Cart Test Lab",
      body: `New angle on ${q}. If this dies in 4 days we kill it.`,
      title: `${q} test`,
      startTime: new Date(Date.now() - 6 * 86_400_000).toISOString(),
      stopTime: null,
      daysActive: 6,
      proven: false,
      snapshotUrl: "https://www.facebook.com/ads/library",
    },
  ];
}

export async function searchCompetitorAds(query: string) {
  const searchTerms = query.trim();
  if (!searchTerms) {
    return { ok: false as const, error: "Enter a product keyword to search the Meta Ad Library." };
  }

  if (!env.metaToken) {
    return {
      ok: true as const,
      mode: "demo" as const,
      warning: "Meta ads are not connected, so these are sample rows. Connect Meta in Settings for live creatives.",
      ads: demoAds(searchTerms),
    };
  }

  const params = new URLSearchParams({
    access_token: env.metaToken,
    ad_type: "all",
    search_terms: searchTerms,
    ad_reached_countries: JSON.stringify(["US"]),
    ad_active_status: "ACTIVE",
    fields: "id,ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,ad_delivery_stop_time,page_name,ad_snapshot_url",
    limit: "25",
  });

  try {
    const res = await fetch(`${GRAPH}?${params}`, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: true as const,
        mode: "demo" as const,
        warning: `Meta Ad Library returned HTTP ${res.status}. Showing samples. ${text.slice(0, 180)}`,
        ads: demoAds(searchTerms),
      };
    }
    const json = (await res.json()) as {
      data?: Array<{
        id?: string;
        page_name?: string;
        ad_creative_bodies?: string[];
        ad_creative_link_titles?: string[];
        ad_delivery_start_time?: string;
        ad_delivery_stop_time?: string;
        ad_snapshot_url?: string;
      }>;
    };
    const ads = (json.data ?? []).map((row) => {
      const daysActive = daysBetween(row.ad_delivery_start_time ?? null, row.ad_delivery_stop_time ?? null);
      return {
        id: String(row.id ?? crypto.randomUUID()),
        pageName: row.page_name ?? "Unknown page",
        body: row.ad_creative_bodies?.[0] ?? "",
        title: row.ad_creative_link_titles?.[0] ?? "",
        startTime: row.ad_delivery_start_time ?? null,
        stopTime: row.ad_delivery_stop_time ?? null,
        daysActive,
        proven: daysActive >= 30,
        snapshotUrl: row.ad_snapshot_url ?? null,
      } satisfies CompetitorAd;
    });
    ads.sort((a, b) => b.daysActive - a.daysActive);
    return { ok: true as const, mode: "live" as const, warning: undefined, ads };
  } catch (error) {
    return {
      ok: true as const,
      mode: "demo" as const,
      warning: error instanceof Error ? error.message : "Ad Library lookup failed.",
      ads: demoAds(searchTerms),
    };
  }
}
