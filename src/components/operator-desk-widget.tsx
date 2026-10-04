"use client";

import { useState, useTransition } from "react";
import { completeDailyDirective, restoreDailyDirective } from "@/app/actions/operator-desk";
import { Badge, Button, Card } from "./ui";
import { DeskLink } from "./desk-link";
import { money } from "@/lib/utils";
import { stageLabel, type PipelineStage } from "@/lib/operator-desk";

export function OperatorDeskWidget({
  directive,
}: {
  directive: {
    id: string;
    stage: string;
    headline: string;
    body: string;
    actionType: string;
    actionHref: string | null;
    actionLabel: string | null;
    spendToday: number;
    spendCap: number;
    completed: boolean;
    dateLocal: string;
  } | null;
}) {
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState(false);
  if (!directive || hidden) return null;
  const stage = directive.stage as PipelineStage;
  const ephemeral = directive.id === "dir_local_today";

  return (
    <Card className="mb-6 border-accent/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            Daily operator desk
          </p>
          <p className="mt-1 text-xs text-muted">
            Pipeline: <span className="font-medium text-ink">{stageLabel(stage)}</span>
            {" · "}
            Spend {money(directive.spendToday)}
            {directive.spendCap > 0 ? ` / ${money(directive.spendCap)} cap` : ""}
          </p>
        </div>
        <Badge tone={directive.completed ? "line" : stage === "CULLING" ? "loss" : "profit"}>
          {directive.completed ? "Done" : "Today’s one job"}
        </Badge>
      </div>
      <h2 className="mt-3 text-base font-semibold text-ink">{directive.headline}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted">{directive.body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {directive.actionHref && !directive.completed ? (
          <DeskLink href={directive.actionHref}>
            <Button tone="accent" disabled={pending}>
              {directive.actionLabel || "Open"}
            </Button>
          </DeskLink>
        ) : null}
        <Button
          tone="line"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (ephemeral) {
                setHidden(true);
                return;
              }
              if (directive.completed) await restoreDailyDirective(directive.id);
              else {
                await completeDailyDirective(directive.id);
                setHidden(true);
              }
            })
          }
        >
          {directive.completed ? "Show again" : "Dismiss"}
        </Button>
      </div>
    </Card>
  );
}
