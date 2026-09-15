import "server-only";

import { env } from "../env";

export type LensMatch = {
  title: string;
  link: string;
  source: string;
};

export async function reverseImageSearch(imageUrl: string): Promise<{
  mode: "live" | "demo";
  matches: LensMatch[];
  warning?: string;
}> {
  if (!env.serpApiKey) {
    return {
      mode: "demo",
      matches: [
        {
          title: "Similar listing on AliExpress (demo)",
          link: "https://www.aliexpress.com/item/1005105.html",
          source: "AliExpress",
        },
        {
          title: "CJ Dropshipping US warehouse match (demo)",
          link: "https://cjdropshipping.com/product/pawrinse",
          source: "CJ",
        },
      ],
      warning:
        "SerpApi is not connected. These are sample matches. Add SERPAPI_KEY to reverse-search competitor ads for real.",
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
    visual_matches?: Array<{ title?: string; link?: string; source?: string }>;
  };
  return {
    mode: "live",
    matches: (json.visual_matches ?? []).slice(0, 8).map((m) => ({
      title: m.title || "Match",
      link: m.link || "",
      source: m.source || "web",
    })),
  };
}
