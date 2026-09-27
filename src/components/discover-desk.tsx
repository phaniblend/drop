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
import { unitMargin, suggestedRetail } from "@/lib/money";
import { DISCOVER_SORTS, sortDiscoverItems, type DiscoverSortId, discoverMetrics } from "@/lib/discover-sort";
import { savedListingKey } from "@/lib/saved-listing";
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

  const rows = sortDiscoverItems(showSaved ? savedRows : (liveRows ?? []), sort);

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
          <StatusHint
            label={cjLive ? "CJ on" : "CJ optional"}
            tone={cjLive ? "profit" : "line"}
            detail={
              cjLive
                ? "Search mixes AliExpress with CJ Dropshipping. Pick whichever cost and ship time looks better."
                : "AliExpress is the default. Connect a CJ key in Settings if you want their catalog mixed in — you can import without it."
            }
            active={statusHint}
            onToggle={setStatusHint}
          />
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
          ) : (
            <StatusHint
              label="Visual match soon"
              tone="line"
              detail="Reverse image search is not connected on this desk yet. Use the search bar or a supplier URL."
              active={statusHint}
              onToggle={setStatusHint}
            />
          )}
        </div>
        {statusHint ? <p className="text-xs leading-5 text-muted">{statusHint}</p> : null}
      </div>

      <div className="rounded-2xl border-2 border-accent/45 bg-accent/[0.05] p-4 shadow-[0_10px_28px_rgba(37,99,235,0.08)]">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Start here</p>
        <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xl flex-1 border-accent/40`}
          placeholder="Search for products to sell"
          value={query}
          onChange={(e) => {
            setShowSaved(false);
            setQuery(e.target.value);
          }}
        />
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
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span className="uppercase tracking-wider text-faint">Sort</span>
          <select
            className={`${inputClass} h-9 w-[11.5rem] py-1 text-xs`}
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
        <p className="text-sm text-muted">No listings matched. Try two or three simple words, or All.</p>
      ) : null}

      {rows.length > 0 ? (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((p) => {
          const variantCosts = (p.variants ?? [])
            .map((v) => v.cost)
            .filter((c) => Number.isFinite(c) && c > 0);
          const minCost = variantCosts.length ? Math.min(...variantCosts) : p.cost;
          const maxCost = variantCosts.length ? Math.max(...variantCosts) : p.cost;
          const displayCost = minCost;
          const shipKnown = p.shipping > 0;
          const costLabel =
            displayCost <= 0
              ? "On import"
              : variantCosts.length > 1 && maxCost - minCost > 0.01
                ? `from ${money(minCost)}${shipKnown ? ` + ~${money(p.shipping)} ship` : " + ship unknown"}`
                : shipKnown
                  ? `${money(displayCost)} + ~${money(p.shipping)} ship`
                  : `${money(displayCost)} + ship unknown`;
          const retail = suggestedRetail(displayCost, p.shipping, 3);
          const econ = unitMargin(retail, displayCost, p.shipping);
          const score = discoverMetrics(p).score;
          const shipLabel =
            p.shippingDays > 0 ? `${p.shippingDays}d ship` : "— ship";
          const listingKey = savedListingKey(p);
          const isSaved = savedKeys.has(listingKey);
          return (
            <Card key={`${listingKey}-${p.id}`} className="overflow-hidden">
              <Thumb src={p.image} alt={p.cleanTitle} className="h-40 w-full rounded-none" />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{p.cleanTitle}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted">{p.title}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-faint">
                      {p.source === "cj" ? "CJ Dropshipping" : "AliExpress"}
                      {p.rating ? ` · ${p.rating.toFixed(1)} rating` : ""}
                      {p.stockKnown === false ? " · confirm stock on import" : ""}
                    </p>
                  </div>
                  <Badge tone={score >= 75 ? "profit" : score >= 60 ? "warn" : "line"}>{score}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-faint">Your cost</p>
                    <p className="mt-0.5 text-muted">{costLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-faint">Suggested sell (3×)</p>
                    <p className="mt-0.5 font-semibold text-ink">{displayCost > 0 ? money(retail) : "—"}</p>
                  </div>
                  <span className="text-profit">
                    {displayCost > 0 && shipKnown ? `${pct(econ.margin)} after fees` : "Margin unknown"}
                  </span>
                  <span className="text-right text-muted">
                    {p.orders30d
                      ? `${p.orders30d.toLocaleString()} sold / 30d`
                      : `${shipLabel} · ${
                          p.stockKnown === false || p.stock <= 0 ? "— pcs" : `${p.stock} pcs`
                        }`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        setError("");
                        try {
                          const res = await importLiveListing(p);
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
            </Card>
          );
        })}
      </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="lg:pt-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Other ways in</p>
          <h2 className="mt-1 text-sm font-semibold leading-6 text-ink">
            You can also bring a listing in by URL, CSV, or a photo.
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
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
        <Card className={`p-5 ${serpLive ? "" : "border-dashed bg-surface-2/60"}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted">Visual match (competitor ad)</span>
            <Badge tone={serpLive ? "profit" : "warn"}>{serpLive ? "Beta" : "Coming soon"}</Badge>
          </div>
          <input
            className={inputClass}
            placeholder={serpLive ? "https://image-url-from-ad.jpg" : "Connect visual match in Settings"}
            value={lensUrl}
            disabled={!serpLive}
            onChange={(e) => setLensUrl(e.target.value)}
          />
          <p className="mt-1.5 text-[11px] text-faint">
            {serpLive
              ? "Paste a competitor ad photo to find a matching supplier listing."
              : "Not connected yet. Search by name or paste a supplier URL instead."}
          </p>
          <Button
            className="mt-3 w-full"
            tone="line"
            disabled={!serpLive || pending || !lensUrl}
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
            {serpLive ? "Reverse search" : "Reverse search (soon)"}
          </Button>
          <CompetitorAdsPanel defaultQuery={query || factoryBest?.title || ""} />
        </Card>
        </div>
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
