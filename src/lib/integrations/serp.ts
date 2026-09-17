import "server-only";

import { env } from "../env";

export type LensMatch = {
  title: string;
  link: string;
  source: string;
  price?: number;
  factory: boolean;
};

const FACTORY_HOST = /aliexpress\.com|cjdropshipping\.com|1688\.com/i;

function isFactory(link: string, source: string) {
  return FACTORY_HOST.test(link) || FACTORY_HOST.test(source);
}

function priceOf(m: { price?: { extracted_value?: number; value?: string } }) {
  if (typeof m.price?.extracted_value === "number") return m.price.extracted_value;
  const parsed = parseFloat(String(m.price?.value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function reverseImageSearch(imageUrl: string): Promise<{
  mode: "live" | "offline";
  matches: LensMatch[];
  factoryBest: LensMatch | null;
  warning?: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error("Paste a full http(s) image URL from the ad.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Image URL must start with http or https.");
  }

  if (!env.serpApiKey) {
    return {
      mode: "offline",
      matches: [],
      factoryBest: null,
      warning: "SerpApi is not connected yet. Reverse search stays off until SERPAPI_KEY is set.",
    };
  }

  const url = `https://serpapi.com/search.json?${new URLSearchParams({
    engine: "google_lens",
    url: imageUrl,
    api_key: env.serpApiKey,
  })}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SerpApi ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    visual_matches?: Array<{
      title?: string;
      link?: string;
      source?: string;
      price?: { extracted_value?: number; value?: string };
    }>;
  };

  const mapped: LensMatch[] = (json.visual_matches ?? [])
    .map((m) => {
      const link = m.link || "";
      const source = m.source || "web";
      return {
        title: m.title || "Match",
        link,
        source,
        price: priceOf(m),
        factory: isFactory(link, source),
      };
    })
    .filter((m) => m.link);

  const factory = mapped.filter((m) => m.factory);
  const ranked = [...factory].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  const factoryBest = ranked[0] ?? null;

  return {
    mode: "live",
    matches: (factory.length ? factory : mapped).slice(0, 8),
    factoryBest,
    warning: factory.length
      ? undefined
      : "No AliExpress / CJ matches in this Lens result. Showing the raw visual matches.",
  };
}
