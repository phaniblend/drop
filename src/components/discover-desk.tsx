"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  importFromFeed,
  importFromSupplierUrl,
  importProductsCsv,
  importScrapedListing,
} from "@/app/actions/products";
import { postJson } from "@/lib/retry-fetch";
import { visualSearch } from "@/app/actions/ops";
import { winningScore, unitMargin, suggestedRetail } from "@/lib/money";
import { money, pct } from "@/lib/utils";
import type { FeedProduct } from "@/lib/supplier-feed";
import { isAliExpressItemUrl } from "@/lib/aliexpress-url";
import type { ScrapedListing } from "@/lib/aliexpress-scrape/types";
import { emitPaywall, hasPaywall, type PaywallPayload } from "@/lib/paywall";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { Thumb } from "./thumb";
import { CompetitorAdsPanel } from "./competitor-ads-panel";

const NICHES = ["all", "home", "car", "pet", "beauty", "health", "outdoors"] as const;

export function DiscoverDesk({
  feed,
  aiLive,
  serpLive,
  aliLive,
}: {
  feed: FeedProduct[];
  aiLive: boolean;
  serpLive: boolean;
  aliLive: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [niche, setNiche] = useState<(typeof NICHES)[number]>("all");
  const [url, setUrl] = useState("");
  const [csv, setCsv] = useState("");
  const [lensUrl, setLensUrl] = useState("");
  const [lens, setLens] = useState<
    Array<{ title: string; link: string; source: string; price?: number; factory: boolean }>
  >([]);
  const [factoryBest, setFactoryBest] = useState<{
    title: string;
    link: string;
    source: string;
    price?: number;
  } | null>(null);
  const [lensWarning, setLensWarning] = useState("");
  const [error, setError] = useState("");
  const [liveRows, setLiveRows] = useState<FeedProduct[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const [pending, start] = useTransition();
  const [searching, setSearching] = useState(false);
  const [scraping, setScraping] = useState(false);

  useEffect(() => {
    if (!aliLive) {
      setLiveRows(null);
      setSearchError("");
      setSearching(false);
      return;
    }
    if (query.trim().length < 2 && niche === "all") {
      setLiveRows([]);
      setSearchError("");
      setSearching(false);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await postJson<{ items: FeedProduct[]; error?: string }>("/api/discover/search", {
          query,
          niche,
        });
        if (cancelled) return;
        setLiveRows(res.items);
        setSearchError(res.error ?? "");
      } catch {
        if (cancelled) return;
        setLiveRows([]);
        setSearchError("Search didn't come back. Try again.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [aliLive, query, niche]);

  const rows = useMemo(() => {
    if (aliLive) return liveRows ?? [];
    const q = query.trim().toLowerCase();
    return feed.filter((p) => {
      const hay = `${p.title} ${p.cleanTitle} ${p.tags.join(" ")}`.toLowerCase();
      return (!q || hay.includes(q)) && (niche === "all" || p.niche === niche);
    });
  }, [aliLive, liveRows, feed, query, niche]);

  async function runImportUrl(target: string) {
    setError("");
    if (!isAliExpressItemUrl(target)) {
      setError("Paste a valid AliExpress item link, like https://www.aliexpress.com/item/123.html");
      return;
    }

    setScraping(true);
    try {
      const scrapeRes = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target.trim() }),
      });
      const json = (await scrapeRes.json()) as {
        ok?: boolean;
        data?: ScrapedListing;
        error?: string;
      } & Partial<PaywallPayload>;
      if (json.code && json.message) {
        emitPaywall({
          code: json.code,
          message: json.message,
          limit: json.limit,
          used: json.used,
          resource: json.resource,
        });
        return;
      }
      if (!scrapeRes.ok || !json.ok || !json.data) {
        setError(json.error || "Could not scrape that listing.");
        return;
      }
      const saved = await importScrapedListing(json.data);
      if (hasPaywall(saved)) {
        emitPaywall(saved.paywall);
        return;
      }
      if ("reused" in saved && saved.reused) {
        setError("Already in your catalog — opening the existing draft.");
      }
      router.push(`/catalog/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Discover</p>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Find something worth testing</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {aliLive
            ? "Search hits AliExpress live. Import URL scrapes the listing into a catalog draft."
            : "Paste an AliExpress item URL to scrape a live listing into a catalog draft. Search still uses the sandbox feed until Open Platform keys exist."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone={aliLive ? "profit" : "line"}>
          {aliLive ? "Live supplier search" : "Sample listings"}
        </Badge>
        <Badge tone={aiLive ? "profit" : "line"}>{aiLive ? "AI rewrite on" : "Quick clean titles"}</Badge>
        {serpLive ? <Badge tone="profit">Visual match on</Badge> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <Field
            label="Supplier URL"
            hint="Paste an AliExpress item URL. We fetch the listing, then save a catalog draft."
          >
            <input
              className={inputClass}
              placeholder="https://www.aliexpress.com/item/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <Button
            className="mt-3 w-full"
            tone="accent"
            disabled={pending || scraping || !url}
            onClick={() => void runImportUrl(url)}
          >
            {scraping ? "Scraping product data..." : "Import URL"}
          </Button>
        </Card>
        <Card className="p-5">
          <Field label="CSV from your current stack" hint="title, supplier_url, cost, shipping, product_code, stock">
            <textarea
              className={`${inputClass} min-h-[84px] font-mono text-xs`}
              placeholder={"title,cost,shipping,product_code,stock\nNeck fan,6.40,2.10,FAN-1,180"}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
          </Field>
          <label className="mt-2 block cursor-pointer text-xs text-accent hover:text-accent-2">
            Or choose a .csv file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                file.text().then(setCsv);
              }}
            />
          </label>
          <Button
            className="mt-3 w-full"
            tone="line"
            disabled={pending || !csv}
            onClick={() =>
              start(async () => {
                setError("");
                try {
                  const res = await importProductsCsv(csv);
                  if (hasPaywall(res)) {
                    emitPaywall(res.paywall);
                    if (res.count) router.push("/catalog");
                    return;
                  }
                  router.push("/catalog");
                  setCsv("");
                  setError(`Imported ${res.count} drafts.`);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "CSV failed");
                }
              })
            }
          >
            Import CSV
          </Button>
        </Card>
        <Card className="p-5">
          <Field
            label="Visual match (competitor ad)"
            hint={
              serpLive
                ? "Paste a competitor ad photo to find a matching supplier listing."
                : "Visual match is not connected yet. You can still import by name or URL."
            }
          >
            <input
              className={inputClass}
              placeholder="https://image-url-from-ad.jpg"
              value={lensUrl}
              onChange={(e) => setLensUrl(e.target.value)}
            />
          </Field>
          <Button
            className="mt-3 w-full"
            tone="line"
            disabled={pending || !lensUrl}
            onClick={() =>
              start(async () => {
                setError("");
                try {
                  const res = await visualSearch(lensUrl);
                  if (hasPaywall(res)) {
                    emitPaywall(res.paywall);
                    return;
                  }
                  setLens(res.matches);
                  setFactoryBest(res.factoryBest);
                  setLensWarning(res.warning ?? "");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Lens failed");
                }
              })
            }
          >
            Reverse search
          </Button>
          <CompetitorAdsPanel defaultQuery={query || factoryBest?.title || ""} />
        </Card>
      </div>

      {error ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            error.startsWith("Imported")
              ? "border-profit/30 bg-[rgba(61,214,140,0.08)] text-profit"
              : "border-loss/30 bg-[rgba(255,107,122,0.08)] text-loss"
          }`}
        >
          {error}
        </p>
      ) : null}

      {lens.length > 0 || lensWarning ? (
        <Card>
          <CardHeader title="Visual matches" eyebrow="Lens" />
          <div className="space-y-2 px-5 py-4">
            {lensWarning ? <p className="text-xs text-warn">{lensWarning}</p> : null}
            {factoryBest ? (
              <div className="rounded-xl border border-line bg-surface-2 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-faint">Lowest-cost factory hit</p>
                <p className="mt-1 text-sm font-semibold">
                  {factoryBest.source}: {factoryBest.title}
                  {factoryBest.price != null ? ` · ${money(factoryBest.price)}` : ""}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button className="h-8 px-2 text-xs" onClick={() => runImportUrl(factoryBest.link)}>
                    Import this URL
                  </Button>
                  <a href={factoryBest.link} className="self-center text-xs text-accent" target="_blank">
                    Open listing
                  </a>
                </div>
              </div>
            ) : null}
            {lens.map((m) => (
              <a key={m.link} href={m.link} className="block text-sm text-accent hover:underline" target="_blank">
                {m.factory ? "Factory" : m.source}: {m.title}
                {m.price != null ? ` · ${money(m.price)}` : ""}
              </a>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Search for products to sell"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {NICHES.map((n) => (
          <button
            key={n}
            onClick={() => setNiche(n)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${
              niche === n ? "border-accent bg-accent/10 text-ink" : "border-line text-muted"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {searchError ? <p className="text-sm text-loss">{searchError}</p> : null}

      {aliLive && query.trim().length < 2 && niche === "all" ? (
        <p className="text-sm text-muted">Type a product name, or pick a niche to browse.</p>
      ) : null}

      {searching ? <p className="text-sm text-muted">Searching live listings…</p> : null}

      {aliLive && (query.trim().length >= 2 || niche !== "all") && !searching && rows.length === 0 && !searchError ? (
        <p className="text-sm text-muted">No listings matched. Try two or three simple words, or All.</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((p) => {
          const retail = suggestedRetail(p.cost, p.shipping, 3);
          const econ = unitMargin(retail, p.cost, p.shipping);
          const score = winningScore({
            retail,
            cost: p.cost,
            shipping: p.shipping,
            stock: p.stock,
            shippingDays: p.shippingDays,
            demand: p.demand,
          });
          return (
            <Card key={p.id} className="overflow-hidden">
              <Thumb src={p.image} alt={p.cleanTitle} className="h-40 w-full rounded-none" />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{p.cleanTitle}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted">{p.title}</p>
                  </div>
                  <Badge tone={score >= 75 ? "profit" : score >= 60 ? "warn" : "line"}>{score}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <span className="text-muted">
                    {p.cost > 0 ? `Your cost ${money(p.cost + p.shipping)}` : "Cost on import"}
                  </span>
                  <span className="text-right text-ink">{p.cost > 0 ? money(retail) : "—"}</span>
                  <span className="text-profit">{p.cost > 0 ? `${pct(econ.margin)} after fees` : "Margin after import"}</span>
                  <span className="text-right text-muted">
                    {p.orders30d
                      ? `${p.orders30d.toLocaleString()} / 30d`
                      : `${p.shippingDays}d · ${p.stock} pcs`}
                  </span>
                </div>
                <Button
                  className="w-full"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      setError("");
                      try {
                        const res = p.live ? await importFromSupplierUrl(p.url) : await importFromFeed(p.id);
                        if (hasPaywall(res)) {
                          emitPaywall(res.paywall);
                          return;
                        }
                        if ("reused" in res && res.reused) {
                          setError("Already in your catalog — opening the existing draft.");
                        }
                        router.push(`/catalog/${res.id}`);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Import failed");
                      }
                    })
                  }
                >
                  Import & clean
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
