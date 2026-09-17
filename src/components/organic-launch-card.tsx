"use client";

import { useState, useTransition } from "react";
import { overrideOrganicUnlock, saveOrganicViews } from "@/app/actions/ops";
import { ORGANIC_VIEW_FLOOR, parseOrganicViews } from "@/lib/ad-protection";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";

type OrganicProduct = {
  id: string;
  cleanTitle: string | null;
  rawTitle: string;
  organicStatus: string;
  organicViewsJson: string;
};

export function OrganicLaunchCard({
  products,
  catalogCount = 0,
}: {
  products: OrganicProduct[];
  catalogCount?: number;
}) {
  const pending = products.filter((p) => p.organicStatus === "pending");
  if (catalogCount === 0) {
    return (
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wider text-faint">3-video organic test</p>
        <p className="mt-1 text-sm font-semibold">No products yet</p>
        <p className="mt-1 text-xs text-muted">
          Import a product from Discover, then run three hook videos to 1,000+ views before paid ads.
        </p>
      </Card>
    );
  }
  if (pending.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wider text-faint">3-video organic test</p>
        <p className="mt-1 text-sm font-semibold">Paid launch unlocked</p>
        <p className="mt-1 text-xs text-muted">Every imported product either passed 1,000+ views on three hooks or was overridden.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Before paid spend"
        title="3-video organic test"
        action={<Badge tone="warn">{pending.length} locked</Badge>}
      />
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted">
          Record three hook variations, then enter organic TikTok/Shorts views. Margin Guard and Resume stay
          locked until each video is over {ORGANIC_VIEW_FLOOR.toLocaleString()} views.
        </p>
        {pending.map((p) => (
          <OrganicRow key={p.id} product={p} />
        ))}
      </div>
    </Card>
  );
}

function OrganicRow({ product }: { product: OrganicProduct }) {
  const initial = parseOrganicViews(product.organicViewsJson);
  const [views, setViews] = useState<[string, string, string]>([
    String(initial[0] || ""),
    String(initial[1] || ""),
    String(initial[2] || ""),
  ]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const nums = views.map((v) => Math.max(0, Math.round(Number(v) || 0))) as [number, number, number];
  const ready = nums.every((n) => n >= ORGANIC_VIEW_FLOOR);

  return (
    <div className="rounded-xl border border-line bg-bg p-4">
      <p className="text-sm font-semibold">{product.cleanTitle ?? product.rawTitle}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
        <li>Record 3 hook variations from the Catalog Ad Creatives panel.</li>
        <li>Paste organic view counts (need {ORGANIC_VIEW_FLOOR.toLocaleString()}+ each).</li>
        <li>Unlock Margin Guard & paid launch.</li>
      </ol>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {["Hook A", "Hook B", "Hook C"].map((label, i) => (
          <Field key={label} label={`${label} views`}>
            <input
              className={inputClass}
              inputMode="numeric"
              value={views[i]}
              onChange={(e) => {
                const next = [...views] as [string, string, string];
                next[i] = e.target.value;
                setViews(next);
              }}
            />
          </Field>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          tone="accent"
          disabled={pending || !ready}
          onClick={() =>
            start(async () => {
              const res = await saveOrganicViews(product.id, nums);
              setMsg(res.status === "passed" ? "Paid launch unlocked." : "Saved. Need 1,000+ on all three.");
            })
          }
        >
          Unlock Margin Guard & Paid Launch
        </Button>
        <Button
          tone="line"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await saveOrganicViews(product.id, nums);
              await overrideOrganicUnlock(product.id);
              setMsg("Manually overridden. Paid launch is on.");
            })
          }
        >
          Override
        </Button>
      </div>
      {msg ? <p className="mt-2 text-xs text-profit">{msg}</p> : null}
    </div>
  );
}
