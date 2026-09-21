"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Card, CardHeader } from "./ui";
import { CopyButton } from "./copy-button";

type AdHookAngle = {
  id: string;
  label: string;
  hook: string;
  script: string;
};

export function AdHooksPanel({
  title,
  description,
  price,
}: {
  title: string;
  description: string;
  price: number;
}) {
  const [pending, start] = useTransition();
  const [hooks, setHooks] = useState<AdHookAngle[]>([]);
  const [mode, setMode] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);

  function generate() {
    setError("");
    start(async () => {
      try {
        const res = await fetch("/api/ai/generate-hooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description.replace(/<[^>]+>/g, " "),
            benefits: description.replace(/<[^>]+>/g, " ").slice(0, 400),
            price,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string; hooks?: AdHookAngle[]; mode?: string };
        if (!res.ok || !json.hooks?.length) {
          setError(json.error || "Could not generate ad angles.");
          return;
        }
        setHooks(json.hooks);
        setMode(json.mode ?? "");
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
          <Button tone="accent" disabled={pending} onClick={generate}>
            {pending ? "Writing…" : "Generate Ad Angles"}
          </Button>
        }
      />
      <div className="space-y-3 p-5">
        <p className="text-sm text-muted">
          Three scripts: pain-agitate-solve, visual curiosity / unboxing, and price-anchor. Copy into TikTok or
          Meta before you spend.
        </p>
        {mode ? (
          <Badge tone={mode === "ai" ? "profit" : "line"}>{mode === "ai" ? "AI rewrite" : "Starter templates"}</Badge>
        ) : null}
        {error ? <p className="text-sm text-loss">{error}</p> : null}
        {open && hooks.length > 0
          ? hooks.map((hook) => (
              <div key={hook.id} className="rounded-xl border border-line bg-bg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-faint">{hook.label}</p>
                    <p className="mt-1 text-sm font-semibold">{hook.hook}</p>
                  </div>
                  <CopyButton text={`${hook.hook}\n\n${hook.script}`} label="Copy script" />
                </div>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted">{hook.script}</pre>
              </div>
            ))
          : null}
      </div>
    </Card>
  );
}
