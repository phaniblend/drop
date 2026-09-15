"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importFromFeed, importFromSupplierUrl, importProductsCsv } from "@/app/actions/products";
import { visualSearch } from "@/app/actions/ops";
import { winningScore, unitMargin, suggestedRetail } from "@/lib/money";
import { money, pct } from "@/lib/utils";
import type { FeedProduct } from "@/lib/supplier-feed";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { Thumb } from "./thumb";

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
  const [lens, setLens] = useState<Array<{ title: string; link: string; source: string }>>([]);
  const [lensWarning, setLensWarning] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feed.filter((p) => {
      const hay = `${p.title} ${p.cleanTitle} ${p.tags.join(" ")}`.toLowerCase();
      return (!q || hay.includes(q)) && (niche === "all" || p.niche === niche);
    });
  }, [feed, query, niche]);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Discover</p>
        <h1 className="mt-1 text-2xl font-semibold">Find something worth testing</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Demo feed is scored for margin, stock, and ship time. Paste a supplier URL or drop a CSV from
          your current tool to onboard an existing catalog.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone={aliLive ? "profit" : "line"}>
          AliExpress {aliLive ? "live" : "demo feed"}
        </Badge>
        <Badge tone={aiLive ? "profit" : "line"}>Copy {aiLive ? "AI Gateway" : "local cleaner"}</Badge>
        <Badge tone={serpLive ? "profit" : "line"}>Lens {serpLive ? "live" : "sample matches"}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <Field label="Supplier URL" hint="Matches the demo feed, AliExpress API, or Playwright if enabled.">
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
            disabled={pending || !url}
            onClick={() =>
              start(async () => {
                setError("");
                try {
                  const res = await importFromSupplierUrl(url);
                  router.push(`/catalog/${res.id}`);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Import failed");
                }
              })
            }
          >
            Import URL
          </Button>
        </Card>
        <Card className="p-5">
          <Field label="CSV from your current stack" hint="title, supplier_url, cost, shipping, sku, stock">
            <textarea
              className={`${inputClass} min-h-[84px] font-mono text-xs`}
              placeholder={"title,cost,shipping,sku,stock\nNeck fan,6.40,2.10,FAN-1,180"}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
          </Field>
          <Button
            className="mt-3 w-full"
            tone="line"
            disabled={pending || !csv}
            onClick={() =>
              start(async () => {
                setError("");
                try {
                  const res = await importProductsCsv(csv);
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
          <Field label="Visual match (competitor ad)" hint="Google Lens via SerpApi when a key is present.">
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
                const res = await visualSearch(lensUrl);
                setLens(res.matches);
                setLensWarning(res.warning ?? "");
              })
            }
          >
            Reverse search
          </Button>
        </Card>
      </div>

      {error ? (
        <p className="rounded-xl border border-loss/30 bg-[rgba(255,107,122,0.08)] px-4 py-3 text-sm text-loss">
          {error}
        </p>
      ) : null}

      {lens.length > 0 ? (
        <Card>
          <CardHeader title="Visual matches" eyebrow="Lens" />
          <div className="space-y-2 px-5 py-4">
            {lensWarning ? <p className="text-xs text-warn">{lensWarning}</p> : null}
            {lens.map((m) => (
              <a key={m.link} href={m.link} className="block text-sm text-accent hover:underline" target="_blank">
                {m.source}: {m.title}
              </a>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Search the feed"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {NICHES.map((n) => (
          <button
            key={n}
            onClick={() => setNiche(n)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${
              niche === n ? "border-accent bg-[rgba(74,163,255,0.12)] text-ink" : "border-line text-muted"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

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
                  <span className="text-muted">Landed {money(p.cost + p.shipping)}</span>
                  <span className="text-right text-ink">{money(retail)}</span>
                  <span className="text-profit">{pct(econ.margin)} after fees</span>
                  <span className="text-right text-muted">{p.shippingDays}d · {p.stock} pcs</span>
                </div>
                <Button
                  className="w-full"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await importFromFeed(p.id);
                      router.push(`/catalog/${res.id}`);
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
