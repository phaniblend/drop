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
  const [open, setOpen] = useState(false);

  if (pending.length === 0 && catalogCount === 0) {
    return (
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wider text-faint">3-video organic test</p>
        <p className="mt-1 text-sm font-semibold">Optional before paid ads</p>
        <p className="mt-1 text-xs text-muted">
          Import a published product, then optionally run three hook videos to 1,000+ views. You can Override anytime —
          Margin Guard still works when Meta is connected.
        </p>
      </Card>
    );
  }
  if (pending.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wider text-faint">3-video organic test</p>
        <p className="mt-1 text-sm font-semibold">Paid launch unlocked</p>
        <p className="mt-1 text-xs text-muted">
          Published products either passed 1,000+ views on three hooks or were overridden.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Before paid spend"
        title="3-video organic test"
        action={<Badge tone="warn">{pending.length} published locked</Badge>}
      />
      <div className="space-y-3 p-5">
        <p className="text-sm text-muted">
          Optional checklist for published products. Margin Guard works with Meta connected — use Override if you already
          run ads. Need {ORGANIC_VIEW_FLOOR.toLocaleString()}+ organic views per hook to unlock the paid-launch badge.
        </p>
        <Button tone="line" className="h-8 px-3 text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide product list" : `Show ${pending.length} published products`}
        </Button>
        {open
          ? pending.map((p) => <OrganicRow key={p.id} product={p} />)
          : (
            <div className="flex flex-wrap gap-2">
              <Button
                tone="accent"
                className="h-8 px-3 text-xs"
                onClick={() =>
                  void (async () => {
                    await Promise.all(pending.slice(0, 20).map((p) => overrideOrganicUnlock(p.id)));
                    window.location.reload();
                  })()
                }
              >
                Override all ({pending.length})
              </Button>
            </div>
            )}
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
          Unlock
        </Button>
        <Button
          tone="line"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await saveOrganicViews(product.id, nums);
              await overrideOrganicUnlock(product.id);
              setMsg("Overridden — Guard can watch paid ads.");
            })
          }
        >
          Override
        </Button>
      </div>
      {msg ? <p className="mt-2 text-xs text-muted">{msg}</p> : null}
    </div>
  );
}
