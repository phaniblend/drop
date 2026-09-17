"use client";

import { useState } from "react";
import { Badge, Button, inputClass } from "./ui";

type CompetitorAd = {
  id: string;
  pageName: string;
  body: string;
  title: string;
  daysActive: number;
  proven: boolean;
  snapshotUrl: string | null;
};

export function CompetitorAdsPanel({ defaultQuery = "" }: { defaultQuery?: string }) {
  const [query, setQuery] = useState(defaultQuery);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState("");
  const [mode, setMode] = useState("");
  const [ads, setAds] = useState<CompetitorAd[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const q = query.trim() || defaultQuery.trim();
    if (!q) {
      setError("Enter a keyword, like the product name.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/ads/competitor-search?query=${encodeURIComponent(q)}`);
      const json = (await res.json()) as {
        error?: string;
        warning?: string;
        mode?: string;
        ads?: CompetitorAd[];
      };
      if (!res.ok) {
        setError(json.error || "Ad Library lookup failed.");
        return;
      }
      setAds(json.ads ?? []);
      setWarning(json.warning ?? "");
      setMode(json.mode ?? "");
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ad Library lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <input
        className={inputClass}
        placeholder="Keyword from the ad or product"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Button tone="line" className="w-full" disabled={loading} onClick={() => void load()}>
        {loading ? "Searching Meta…" : "View Competitor Ads on Meta"}
      </Button>
      {error ? <p className="text-xs text-loss">{error}</p> : null}
      {open ? (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-faint">Meta Ad Library</p>
              <p className="text-sm font-semibold">Active US ads</p>
            </div>
            <Button tone="ghost" className="h-8 px-2 text-xs" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          {mode ? (
            <div className="mt-2">
              <Badge tone={mode === "live" ? "profit" : "line"}>
                {mode === "live" ? "Live archive" : "Sample rows"}
              </Badge>
            </div>
          ) : null}
          {warning ? <p className="mt-2 text-xs text-warn">{warning}</p> : null}
          <div className="mt-3 space-y-2">
            {ads.length === 0 ? (
              <p className="text-sm text-muted">No active ads matched that keyword.</p>
            ) : (
              ads.map((ad) => (
                <div key={ad.id} className="rounded-lg border border-line bg-surface px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{ad.pageName}</p>
                    {ad.proven ? <Badge tone="profit">Proven 30d+</Badge> : <Badge tone="line">{ad.daysActive}d</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted">{ad.title || ad.body || "No copy returned"}</p>
                  {ad.snapshotUrl ? (
                    <a href={ad.snapshotUrl} target="_blank" className="mt-2 inline-block text-xs text-accent" rel="noreferrer">
                      Open snapshot
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
