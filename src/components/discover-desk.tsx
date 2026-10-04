"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  importLiveListing,
  importFromSupplierUrl,
  importProductsCsv,
  importScrapedListing,
} from "@/app/actions/products";
import { postJson } from "@/lib/retry-fetch";
import { visualSearch } from "@/app/actions/ops";
import { unitMargin, suggestedRetail, breakevenRoas } from "@/lib/money";
import { discoverShippingKnown } from "@/lib/discover-cost";
import { discoverCardCost } from "@/lib/discover-card-cost";
import { licensedBrandWarning, screenListing } from "@/lib/product-screen";
import { DISCOVER_SORTS, sortDiscoverItems, type DiscoverSortId, discoverMetrics } from "@/lib/discover-sort";
import { savedListingKey } from "@/lib/saved-listing";
import { money, pct } from "@/lib/utils";
import type { FeedProduct } from "@/lib/supplier-feed";
import { isAliExpressItemUrl } from "@/lib/aliexpress-url";
import type { ScrapedListing } from "@/lib/aliexpress-scrape/types";
import { emitPaywall, hasPaywall, type PaywallPayload } from "@/lib/paywall";
import { shareListingWithCoach, loadCoachSession } from "@/app/actions/coach";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { Thumb } from "./thumb";
import { CompetitorAdsPanel } from "./competitor-ads-panel";

const NICHES = ["all", "home", "car", "pet", "beauty", "health", "outdoors"] as const;

export function DiscoverDesk({
  serpLive,
  cjLive,
  aliApiLive,
}: {
  aiLive?: boolean;
  serpLive: boolean;
  cjLive: boolean;
  aliApiLive: boolean;
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
  const [sort, setSort] = useState<DiscoverSortId>("best");
  const [showSaved, setShowSaved] = useState(false);
  const [savedRows, setSavedRows] = useState<FeedProduct[]>([]);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState("");
  const [statusHint, setStatusHint] = useState("");
  const [preview, setPreview] = useState<{
    title: string;
    supplierUrl: string;
    costLabel: string;
    baseCost: number;
    shippingCost: number;
    shippingDays: number;
    shippingUnknown?: boolean;
    stockTotal: number;
    accessoriesExcluded: number;
    variants: Array<{ name: string; cost: number; stock: number }>;
    images: string[];
    feedCost?: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState("");
  const [pricedOnly, setPricedOnly] = useState(true);
  const [minRating4, setMinRating4] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [coachStep, setCoachStep] = useState("");

  useEffect(() => {
    const onKeyword = (e: Event) => {
      const keyword = (e as CustomEvent<{ keyword?: string }>).detail?.keyword?.trim();
      if (!keyword) return;
      setShowSaved(false);
      setQuery(keyword);
    };
    const onStep = (e: Event) => {
      setCoachStep((e as CustomEvent<{ step?: string }>).detail?.step ?? "");
    };
    window.addEventListener("seto-coach-keyword", onKeyword);
    window.addEventListener("seto-coach-step", onStep);
    void loadCoachSession()
      .then((s) => {
        if (!s) return;
        setCoachStep(s.stepId);
        if (s.stepId === "pick" && s.keyword) {
          setShowSaved(false);
          setQuery((q) => (q.trim().length >= 2 ? q : s.keyword));
        }
      })
      .catch(() => {});
    return () => {
      window.removeEventListener("seto-coach-keyword", onKeyword);
      window.removeEventListener("seto-coach-step", onStep);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("seto_discover_filters_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { pricedOnly?: boolean; minRating4?: boolean; inStockOnly?: boolean };
      if (parsed.pricedOnly) setPricedOnly(true);
      if (parsed.minRating4) setMinRating4(true);
      if (parsed.inStockOnly) setInStockOnly(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "seto_discover_filters_v1",
        JSON.stringify({ pricedOnly, minRating4, inStockOnly }),
      );
    } catch {
      /* ignore */
    }
  }, [pricedOnly, minRating4, inStockOnly]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/discover/saved", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { items?: FeedProduct[]; keys?: string[] }) => {
        if (cancelled) return;
        setSavedRows(data.items ?? []);
        setSavedKeys(new Set(data.keys ?? []));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (showSaved) {
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
  }, [query, niche, showSaved]);

  const sorted = sortDiscoverItems(showSaved ? savedRows : (liveRows ?? []), sort);
  const rows = sorted.filter((p) => {
    const card = discoverCardCost(p);
    // "Priced only" means a verified offer cost — not an untrusted feed estimate.
    if (pricedOnly && !card.verified) return false;
    if (minRating4 && !(p.rating && p.rating >= 4)) return false;
    if (inStockOnly && (p.stockKnown === false || p.stock <= 0)) return false;
    return true;
  });

  async function toggleSave(item: FeedProduct) {
    const key = savedListingKey(item);
    setSavingKey(key);
    setError("");
    try {
      const res = await postJson<{ items: FeedProduct[]; keys: string[] }>("/api/discover/saved", { item });
      setSavedRows(res.items);
      setSavedKeys(new Set(res.keys));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save listing.");
    } finally {
      setSavingKey("");
    }
  }

  async function runImportUrl(target: string) {
    setError("");
    const trimmed = target.trim();
    const isCj = /cjdropshipping\.(com|cn)/i.test(trimmed);
    if (!isAliExpressItemUrl(trimmed) && !isCj) {
      setError("Paste an AliExpress item link or a CJ Dropshipping product URL.");
      return;
    }

    if (isCj) {
      setScraping(true);
      try {
        const res = await importFromSupplierUrl(trimmed);
        if (hasPaywall(res)) {
          emitPaywall(res.paywall);
          return;
        }
        router.push(`/catalog/${res.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      } finally {
        setScraping(false);
      }
      return;
    }

    setScraping(true);
    try {
      const scrapeRes = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
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
      window.dispatchEvent(new Event("seto-coach-shared"));
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
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">What do you want to sell?</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Search live suppliers
          {cjLive ? " (AliExpress + CJ)" : " on AliExpress"}
          {aliApiLive ? " with Open API enrich" : ""}
          , then import a listing into your catalog. Small ad spend decides if it deserves more budget —
          Seto watches the rest.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <StatusHint
            label="Live supplier search"
            tone="profit"
            detail="Each search pulls a fresh AliExpress set. Save a card if you want that listing back later."
            active={statusHint}
            onToggle={setStatusHint}
          />
          {cjLive ? (
            <StatusHint
              label="CJ on"
              tone="profit"
              detail="Search mixes AliExpress with CJ Dropshipping. Pick whichever cost and ship time looks better."
              active={statusHint}
              onToggle={setStatusHint}
            />
          ) : null}
          <StatusHint
            label="Clean titles"
            tone="profit"
            detail="Supplier junk (ships-from, warehouse labels) is stripped so the catalog title is shopper-ready."
            active={statusHint}
            onToggle={setStatusHint}
          />
          {serpLive ? (
            <StatusHint
              label="Visual match on"
              tone="profit"
              detail="Paste a competitor ad photo to hunt a matching supplier listing."
              active={statusHint}
              onToggle={setStatusHint}
            />
          ) : null}
        </div>
        {statusHint ? <p className="text-xs leading-5 text-muted">{statusHint}</p> : null}
      </div>

      <div className="rounded-2xl border-2 border-accent/45 bg-accent/[0.05] p-4 shadow-[0_10px_28px_rgba(37,99,235,0.08)]">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Start here</p>
        <input
          className={`${inputClass} border-accent/40`}
          placeholder="Search for products to sell"
          value={query}
          onChange={(e) => {
            setShowSaved(false);
            setQuery(e.target.value);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
        {NICHES.map((n) => (
          <button
            key={n}
            onClick={() => {
              setShowSaved(false);
              setNiche(n);
            }}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${
              !showSaved && niche === n ? "border-accent bg-accent/10 text-ink" : "border-line text-muted"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => setShowSaved((open) => !open)}
          className={`rounded-full border px-3 py-1 text-xs ${
            showSaved ? "border-accent bg-accent/10 text-ink" : "border-line text-muted"
          }`}
        >
          Saved{savedRows.length ? ` (${savedRows.length})` : ""}
        </button>
        </div>
      </div>

      {searchError ? <p className="text-sm text-loss">{searchError}</p> : null}

      {showSaved ? (
        <p className="text-sm text-muted">
          Saved listings stay here even when search returns a new set. Import from this list anytime.
        </p>
      ) : query.trim().length < 2 && niche === "all" ? (
        <p className="text-sm text-muted">Type a product name, or pick a niche to browse live suppliers.</p>
      ) : null}

      {searching ? <p className="text-sm text-muted">Searching live listings…</p> : null}

      {showSaved && rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing saved yet. Hit Save on a listing so the next search does not lose it.</p>
      ) : null}

      {!showSaved && (query.trim().length >= 2 || niche !== "all") && !searching && rows.length === 0 && !searchError ? (
        <p className="text-sm text-muted">
          {pricedOnly && sorted.length > 0
            ? `${sorted.length} listing${sorted.length === 1 ? "" : "s"} hid because cost was missing — turn off “Priced only” to see them, or open a card to refresh the offer price.`
            : "No listings matched. Try two or three simple words, or All."}
        </p>
      ) : null}

      {rows.length > 0 ? (
      <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {rows.length} listing{rows.length === 1 ? "" : "s"}
          {showSaved ? " saved" : ""}
          {sorted.length !== rows.length ? ` (of ${sorted.length})` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={pricedOnly} onChange={(e) => setPricedOnly(e.target.checked)} />
            Priced only
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={minRating4} onChange={(e) => setMinRating4(e.target.checked)} />
            4★+
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
            In stock
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <span className="font-medium">Sort by</span>
            <select
              className={`${inputClass} h-10 w-[14rem] border-accent/40 py-1 text-sm font-medium`}
              value={sort}
              onChange={(e) => setSort(e.target.value as DiscoverSortId)}
            >
              {DISCOVER_SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((p) => {
          const card = discoverCardCost(p);
          const displayCost = card.cost;
          const shipKnown = discoverShippingKnown(p.shipping);
          const shipping = card.shipping;
          const costLabel = !card.verified
            ? "Verify cost on import"
            : shipKnown
              ? `${money(displayCost)} + ~${money(p.shipping)} ship`
              : `${money(displayCost)} + ~${money(shipping)} ship (est.)`;
          const retail = displayCost > 0 ? suggestedRetail(displayCost, shipping, 3) : 0;
          const econ = unitMargin(retail, displayCost, shipping);
          const metrics = discoverMetrics(p);
          const score = metrics.score;
          const licensed = licensedBrandWarning(p.title, p.cleanTitle);
          const screen = !licensed ? screenListing({ title: `${p.title} ${p.cleanTitle}` }) : null;
          const shipLabel =
            p.shippingDays > 0 ? `${p.shippingDays}d ship` : "est. ship";
          const listingKey = savedListingKey(p);
          const isSaved = savedKeys.has(listingKey);
          return (
            <Card key={`${listingKey}-${p.id}`} className={coachStep === "pick" ? "overflow-hidden border-accent/50" : "overflow-hidden"}>
              <Thumb src={p.image} alt={p.cleanTitle} className="aspect-square w-full rounded-none" />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold" title={p.title}>
                      {p.cleanTitle}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-faint">
                      {p.source === "cj" ? "CJ Dropshipping" : "AliExpress"}
                      {p.rating ? ` · ${p.rating.toFixed(1)}★` : ""}
                      {p.orders30d ? ` · ${p.orders30d.toLocaleString()} sold/30d` : ""}
                      {p.shippingDays > 0 ? ` · ${p.shippingDays}d ship` : ""}
                      {p.stockKnown === false
                        ? " · confirm stock on import"
                        : p.stock > 0
                          ? ` · ${p.stock} pcs`
                          : ""}
                    </p>
                  </div>
                  <span
                    title={
                      score > 0
                        ? `Score /100 from ${metrics.scoreDrivers?.join(", ") || "margin"}`
                        : "Needs a priced listing"
                    }
                  >
                    <Badge tone={score >= 75 ? "profit" : score >= 50 ? "warn" : "line"}>
                      {score > 0 ? `${score}/100` : "—"}
                    </Badge>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-faint">
                      {card.verified ? "Landed cost est." : "Cost"}
                    </p>
                    <p className="mt-0.5 text-muted">{costLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-faint">Suggested sell (cost+ship)×3</p>
                    <p className="mt-0.5 font-semibold text-ink">{displayCost > 0 ? money(retail) : "—"}</p>
                  </div>
                  <span className="text-profit">
                    {displayCost > 0
                      ? `${pct(econ.margin)} before ads${shipKnown ? "" : " (est.)"}`
                      : "Margin on import"}
                  </span>
                  <span className="text-right text-muted">
                    {p.orders30d
                      ? `${p.orders30d.toLocaleString()} sold / 30d`
                      : displayCost > 0
                        ? (() => {
                            const be = breakevenRoas(retail, displayCost, shipping);
                            return Number.isFinite(be) && be > 0 ? `BE ROAS ${be.toFixed(1)}x` : "—";
                          })()
                        : `${shipLabel}${
                            p.stockKnown === false || p.stock <= 0 ? "" : ` · ${p.stock} pcs`
                          }`}
                  </span>
                </div>
                {licensed ? <p className="text-xs text-loss">{licensed}</p> : null}
                {screen && !screen.ok ? <p className="text-xs text-warn">{screen.reason}</p> : null}
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full"
                    tone="accent"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        setError("");
                        try {
                          await shareListingWithCoach({
                            title: p.cleanTitle || p.title,
                            url: p.url,
                            image: p.image,
                            cost: displayCost,
                            source: p.source,
                          });
                          window.dispatchEvent(new Event("seto-coach-shared"));
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Could not share that listing.");
                        }
                      })
                    }
                  >
                    Share with Seto
                  </Button>
                  <Button
                    className="w-full"
                    tone={coachStep === "import" ? "accent" : "line"}
                    disabled={pending || scraping}
                    onClick={() =>
                      start(async () => {
                        await runImportUrl(p.url);
                      })
                    }
                  >
                    {scraping ? "Importing…" : "Import"}
                  </Button>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    tone="line"
                    disabled={pending || previewLoading === p.url}
                    onClick={() =>
                      start(async () => {
                        setError("");
                        setPreviewLoading(p.url);
                        try {
                          const res = await postJson<{
                            ok?: boolean;
                            data?: {
                              title: string;
                              supplierUrl: string;
                              costLabel: string;
                              baseCost: number;
                              shippingCost: number;
                              shippingDays: number;
                              shippingUnknown?: boolean;
                              stockTotal: number;
                              accessoriesExcluded: number;
                              variants: Array<{ name: string; cost: number; stock: number }>;
                              images: string[];
                            };
                            error?: string;
                          }>("/api/scrape", { url: p.url });
                          if (!res.data) throw new Error(res.error || "Preview failed");
                          setPreview({ ...res.data, feedCost: displayCost > 0 ? displayCost : undefined });
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Preview failed");
                        } finally {
                          setPreviewLoading("");
                        }
                      })
                    }
                  >
                    {previewLoading === p.url ? "Fetching…" : "Preview (free)"}
                  </Button>
                  <Button
                    tone={isSaved ? "accent" : "line"}
                    className="w-[5.5rem] shrink-0"
                    disabled={savingKey === listingKey}
                    onClick={() => toggleSave(p)}
                  >
                    {savingKey === listingKey ? "…" : isSaved ? "Saved" : "Save"}
                  </Button>
                </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      </div>
      ) : null}

      <details className="rounded-2xl border border-line bg-surface open:shadow-[0_8px_24px_rgba(15,18,34,0.05)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          <span>Or import via direct link / CSV</span>
          <span className="text-xs font-normal text-muted">URL, spreadsheet, or photo</span>
        </summary>
        <div className="grid gap-4 border-t border-line p-5 lg:grid-cols-3">
        <Card className="p-5">
          <Field
            label="Supplier URL"
            hint="Paste an AliExpress or CJ Dropshipping product URL."
          >
            <input
              className={inputClass}
              placeholder="https://www.aliexpress.com/item/... or cjdropshipping.com/..."
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
        {serpLive ? (
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted">Visual match (competitor ad)</span>
              <Badge tone="profit">Beta</Badge>
            </div>
            <input
              className={inputClass}
              placeholder="https://image-url-from-ad.jpg"
              value={lensUrl}
              onChange={(e) => setLensUrl(e.target.value)}
            />
            <p className="mt-1.5 text-[11px] text-faint">
              Paste a competitor ad photo to find a matching supplier listing.
            </p>
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
        ) : (
          <Card className="p-5">
            <CompetitorAdsPanel defaultQuery={query || factoryBest?.title || ""} />
          </Card>
        )}
        </div>
      </details>

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

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">Free preview</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{preview.title}</h2>
            <p className="mt-2 text-sm text-muted">
              Real cost {preview.costLabel}
              {preview.feedCost != null && Math.abs(preview.feedCost - preview.baseCost) > 0.05
                ? ` (Discover card showed ~${money(preview.feedCost)})`
                : ""}
              · Ship{" "}
              {preview.shippingUnknown || preview.shippingCost <= 0
                ? "unknown — enter after import"
                : money(preview.shippingCost)}
              · {preview.stockTotal} pcs sellable
              {preview.accessoriesExcluded
                ? ` · ${preview.accessoriesExcluded} accessory SKU${preview.accessoriesExcluded === 1 ? "" : "s"} hidden`
                : ""}
            </p>
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-muted">
              {preview.variants.slice(0, 12).map((v) => (
                <li key={`${v.name}-${v.cost}`} className="flex justify-between gap-2 border-b border-line/60 py-1">
                  <span className="truncate">{v.name}</span>
                  <span className="shrink-0 font-mono">
                    {money(v.cost)} · {v.stock} pcs
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">
              Preview is free. Import uses 1 catalog credit.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                tone="accent"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError("");
                    try {
                      const res = await importFromSupplierUrl(preview.supplierUrl);
                      if (hasPaywall(res)) {
                        emitPaywall(res.paywall);
                        return;
                      }
                      if ("costWas" in res && res.costWas != null && res.costNow != null) {
                        setError(
                          Math.abs(Number(res.costWas) - Number(res.costNow)) > 0.05
                            ? `Imported. Cost was $${Number(res.costWas).toFixed(2)}, now $${Number(res.costNow).toFixed(2)}.`
                            : "Imported into catalog.",
                        );
                      }
                      setPreview(null);
                      window.dispatchEvent(new Event("seto-coach-shared"));
                      router.push(`/catalog/${res.id}`);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Import failed");
                    }
                  })
                }
              >
                Import
              </Button>
              <Button tone="line" onClick={() => setPreview(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusHint({
  label,
  tone,
  detail,
  active,
  onToggle,
}: {
  label: string;
  tone: "line" | "profit";
  detail: string;
  active: string;
  onToggle: (next: string) => void;
}) {
  const open = active === detail;
  return (
    <button
      type="button"
      title={detail}
      aria-expanded={open}
      onClick={() => onToggle(open ? "" : detail)}
      className={`rounded-full ${open ? "ring-2 ring-accent/40" : ""}`}
    >
      <Badge tone={tone}>{label}</Badge>
    </button>
  );
}
