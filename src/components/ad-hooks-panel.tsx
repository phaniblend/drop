"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, Card, CardHeader } from "./ui";
import { CopyButton } from "./copy-button";
import { formatScript } from "@/lib/format-script";
import { withLivePrice } from "@/lib/live-price";

type AdHookAngle = {
  id: string;
  label: string;
  hook: string;
  script: string;
};

const META_ADS = "https://adsmanager.facebook.com/adsmanager/creation";
const TIKTOK_ADS = "https://ads.tiktok.com/i18n/creation";

async function copyAndOpen(text: string, url: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* still open the manager even if clipboard is blocked */
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function fullScript(hook: AdHookAngle, price: number, productUrl?: string) {
  const body = withLivePrice(formatScript([hook.hook, hook.script]), price);
  if (!productUrl) return body;
  const tagged = `${productUrl}${productUrl.includes("?") ? "&" : "?"}utm_source=seto&utm_medium=paid&utm_campaign=${encodeURIComponent(hook.label)}&utm_content=${encodeURIComponent(hook.id)}`;
  return `${body}\n\nShop: ${tagged}`;
}

export function AdHooksPanel({
  productId,
  title,
  description,
  price,
  productUrl = "",
  initialHooks = [],
}: {
  productId?: string;
  title: string;
  description: string;
  price: number;
  productUrl?: string;
  initialHooks?: AdHookAngle[];
}) {
  const [pending, start] = useTransition();
  const [hooks, setHooks] = useState<AdHookAngle[]>(initialHooks);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(initialHooks.length > 0);
  const [posted, setPosted] = useState<string>("");

  function generate() {
    setError("");
    setReason("");
    setPosted("");
    start(async () => {
      try {
        const res = await fetch("/api/ai/generate-hooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            title,
            description: description.replace(/<[^>]+>/g, " "),
            benefits: description.replace(/<[^>]+>/g, " ").slice(0, 400),
            price,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          hooks?: AdHookAngle[];
          mode?: string;
          reason?: string;
        };
        if (!res.ok || !json.hooks?.length) {
          setError(json.error || "Could not generate ad angles.");
          return;
        }
        setHooks(
          json.hooks.map((h) => ({
            ...h,
            script: formatScript(h.script),
          })),
        );
        setReason(json.mode === "local" ? json.reason ?? "" : "");
        setOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate ad angles.");
      }
    });
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Ad creatives & hooks"
        title="Short-form angles"
        action={
          <Button tone="accent" disabled={pending} aria-busy={pending} onClick={generate}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? "Writing…" : "Write ad angles"}
          </Button>
        }
      />
      <div className="space-y-3 p-5">
        <p className="text-sm text-muted">
          {hooks.length
            ? "Suggested angles — edit freely in Ads Manager after you paste. Post buttons copy script plus a UTM product link."
            : "No angles yet. Write ad angles for three short-form hooks you can paste into Meta or TikTok."}
        </p>
        {reason ? <p className="text-xs text-warn">{reason}</p> : null}
        {pending ? (
          <div className="space-y-2" aria-hidden>
            <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
            <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
          </div>
        ) : null}
        {error ? <p className="text-sm text-loss">{error}</p> : null}
        {posted ? <p className="text-xs text-profit">{posted}</p> : null}
        {open && hooks.length > 0
          ? hooks.map((hook) => {
              const liveHook = withLivePrice(hook.hook, price);
              const liveScript = withLivePrice(formatScript(hook.script), price);
              const full = fullScript(hook, price, productUrl);
              return (
                <div key={hook.id} className="rounded-xl border border-line bg-bg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-wider text-faint">{hook.label}</p>
                      <p className="mt-1 text-sm font-semibold">{liveHook}</p>
                    </div>
                    <CopyButton text={full} label="Copy script" />
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted">
                    {liveScript}
                  </pre>
                  {productUrl ? (
                    <p className="mt-2 break-all font-mono text-[10px] text-faint">
                      UTM link included when you copy / post.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      tone="accent"
                      className="h-9 px-3 text-xs"
                      onClick={() => {
                        void copyAndOpen(full, META_ADS);
                        setPosted(
                          "Script + UTM link copied — paste in Meta Ads Manager, then upload your creative.",
                        );
                      }}
                    >
                      Post on Meta
                    </Button>
                    <Button
                      tone="line"
                      className="h-9 px-3 text-xs"
                      onClick={() => {
                        void copyAndOpen(full, TIKTOK_ADS);
                        setPosted(
                          "Script + UTM link copied — paste it in TikTok Ads Manager, then upload your creative.",
                        );
                      }}
                    >
                      Post on TikTok
                    </Button>
                  </div>
                </div>
              );
            })
          : null}
      </div>
    </Card>
  );
}
