"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GripVertical, MessageCircle, X } from "lucide-react";
import {
  importSharedListing,
  loadCoachSession,
  markCoachStepDone,
  resetCoachToday,
  shareListingWithCoach,
} from "@/app/actions/coach";
import { COACH_STEPS, type CoachStepId } from "@/lib/coach-plan";
import { emitPaywall, hasPaywall } from "@/lib/paywall";
import { Button } from "./ui";
import { DeskLink } from "./desk-link";
import { cn } from "@/lib/utils";

const OPEN_KEY = "seto-coach-open";
const POS_KEY = "seto-coach-pos-v1";
const CARD_MAX = 340;

type Session = Awaited<ReturnType<typeof loadCoachSession>>;

function cardWidth() {
  if (typeof window === "undefined") return CARD_MAX;
  return Math.min(CARD_MAX, window.innerWidth - 16);
}

function defaultPos() {
  if (typeof window === "undefined") return { x: 900, y: 72 };
  const width = cardWidth();
  const mobile = window.innerWidth < 768;
  return {
    x: Math.max(8, window.innerWidth - width - (mobile ? 12 : 24)),
    y: mobile ? 64 : 72,
  };
}

function clampPos(next: { x: number; y: number }) {
  if (typeof window === "undefined") return next;
  const width = cardWidth();
  const mobile = window.innerWidth < 768;
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - (mobile ? 280 : 120));
  return {
    x: Math.min(maxX, Math.max(8, next.x)),
    y: Math.min(maxY, Math.max(8, next.y)),
  };
}

export function HelpGuide({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [session, setSession] = useState<Session>(null);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  function refresh() {
    start(async () => {
      const next = await loadCoachSession();
      setSession(next);
      if (next?.keyword && next.stepId === "pick") {
        window.dispatchEvent(new CustomEvent("seto-coach-keyword", { detail: { keyword: next.keyword } }));
      }
      window.dispatchEvent(new CustomEvent("seto-coach-step", { detail: { step: next?.stepId ?? "pick" } }));
    });
  }

  useEffect(() => {
    const rawPos = window.sessionStorage.getItem(POS_KEY);
    if (rawPos) {
      try {
        const parsed = JSON.parse(rawPos) as { x: number; y: number };
        if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) setPos(clampPos(parsed));
      } catch {
        /* default */
      }
    }
    if (window.sessionStorage.getItem(OPEN_KEY) !== "0") onOpenChange(true);
    setReady(true);
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    const onShared = () => refresh();
    window.addEventListener("resize", onResize);
    window.addEventListener("seto-coach-shared", onShared);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("seto-coach-shared", onShared);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    window.sessionStorage.setItem(OPEN_KEY, open ? "1" : "0");
  }, [open]);

  useEffect(() => {
    if (!ready || !pos) return;
    window.sessionStorage.setItem(POS_KEY, JSON.stringify(pos));
  }, [pos, ready]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [session?.messages.length]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button,input,a,textarea")) return;
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    const current = pos ?? (rect ? { x: rect.left, y: rect.top } : defaultPos());
    drag.current = { px: e.clientX, py: e.clientY, x: current.x, y: current.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPos(
      clampPos({
        x: drag.current.x + (e.clientX - drag.current.px),
        y: drag.current.y + (e.clientY - drag.current.py),
      }),
    );
  }

  function onPointerUp() {
    drag.current = null;
  }

  if (!open) return null;

  const step = (session?.stepId ?? "pick") as CoachStepId;
  const href =
    step === "clean" || step === "publish" || step === "angles"
      ? session?.catalogProductId
        ? `/catalog/${session.catalogProductId}`
        : "/catalog"
      : COACH_STEPS.find((s) => s.id === step)?.href ?? "/discover";

  return (
    <aside
      className="fixed top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] right-3 z-[100] flex w-[min(21.25rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_50px_rgba(15,18,34,0.12)] md:right-6"
      style={pos ? { left: pos.x, top: pos.y, right: "auto" } : undefined}
      role="dialog"
      aria-label="Today’s plan"
      aria-modal="false"
    >
      <div
        className="flex cursor-grab items-center justify-between border-b border-line px-3 py-2 active:cursor-grabbing"
        role="toolbar"
        aria-label="Move coach"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          <GripVertical className="h-3.5 w-3.5 text-faint" />
          Today’s plan
        </p>
        <button
          type="button"
          className="rounded-md p-1 text-muted hover:bg-black/[0.04] hover:text-ink"
          onClick={() => onOpenChange(false)}
          aria-label="Hide coach"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ol className="space-y-1 border-b border-line px-3 py-2">
        {COACH_STEPS.filter((s) => s.id !== "done").map((item, i) => {
          const current = item.id === step;
          const done =
            COACH_STEPS.findIndex((s) => s.id === step) > i || step === "done";
          return (
            <li
              key={item.id}
              className={cn(
                "text-[11px] leading-4",
                current ? "font-semibold text-ink" : done ? "text-faint line-through" : "text-muted",
              )}
            >
              {i + 1}. {item.title}
              {item.id === "pick" && session?.keyword ? ` — ${session.keyword}` : ""}
            </li>
          );
        })}
      </ol>

      <div ref={scroller} className="max-h-[min(22rem,46vh)] space-y-2 overflow-y-auto px-3 py-3">
        {(session?.messages ?? []).map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-xl px-2.5 py-2 text-xs leading-5",
              m.role === "seto" ? "bg-black/[0.04] text-ink" : "ml-6 bg-accent/10 text-ink",
            )}
          >
            <p className="mb-0.5 font-mono text-[9px] uppercase tracking-wider text-faint">
              {m.role === "seto" ? "Seto" : "You"}
            </p>
            {m.text}
          </div>
        ))}
        {!session ? (
          <p className="text-xs text-muted">{pending ? "Loading today’s plan…" : "Sign in to get today’s plan."}</p>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-line px-3 py-3">
        {error ? <p className="text-xs text-loss">{error}</p> : null}
        {step === "pick" ? (
          <div className="flex gap-2">
            <input
              className="h-8 min-w-0 flex-1 rounded-lg border border-line px-2 text-xs"
              placeholder="Or paste a supplier URL"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
            <Button
              tone="line"
              className="h-8 px-2 text-xs"
              disabled={pending || paste.trim().length < 8}
              onClick={() =>
                start(async () => {
                  setError("");
                  try {
                    const next = await shareListingWithCoach({
                      title: paste.trim(),
                      url: paste.trim(),
                    });
                    setSession(next);
                    setPaste("");
                    window.dispatchEvent(new Event("seto-coach-shared"));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save that link.");
                  }
                })
              }
            >
              Share
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <DeskLink href={href}>
            <Button tone="accent" className="h-8 px-2 text-xs" disabled={pending}>
              {step === "pick"
                ? "Open Discover"
                : step === "import"
                  ? "Open Discover"
                  : step === "launch"
                    ? "Open Ads & Guard"
                    : step === "done"
                      ? "Open Command"
                      : "Open listing"}
            </Button>
          </DeskLink>
          {step === "import" ? (
            <Button
              tone="accent"
              className="h-8 px-2 text-xs"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError("");
                  try {
                    const result = await importSharedListing();
                    if (hasPaywall(result)) {
                      emitPaywall(result.paywall);
                      return;
                    }
                    if ("session" in result) setSession(result.session);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Import failed.");
                  }
                })
              }
            >
              Import this listing
            </Button>
          ) : null}
          {step !== "pick" && step !== "import" && step !== "done" ? (
            <Button
              tone="line"
              className="h-8 px-2 text-xs"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError("");
                  try {
                    const result = await markCoachStepDone();
                    if (hasPaywall(result)) {
                      emitPaywall(result.paywall);
                      return;
                    }
                    if ("session" in result) setSession(result.session);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Not done yet.");
                  }
                })
              }
            >
              {step === "publish" ? "I published it" : step === "launch" ? "I launched it" : "I’m done"}
            </Button>
          ) : null}
          {step === "done" ? (
            <Button
              tone="line"
              className="h-8 px-2 text-xs"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const next = await resetCoachToday();
                  setSession(next);
                })
              }
            >
              New plan
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export function HelpMenuButton({
  active,
  onClick,
  placement = "sidebar",
}: {
  active: boolean;
  onClick: () => void;
  placement?: "sidebar" | "topbar";
}) {
  if (placement === "topbar") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Open today’s plan"
        aria-pressed={active}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition",
          active
            ? "border-accent/40 bg-accent/10 text-ink"
            : "border-line text-muted hover:border-line-strong hover:text-ink",
        )}
      >
        <MessageCircle className={cn("h-3.5 w-3.5", active ? "text-accent" : "text-faint")} />
        <span className="hidden sm:inline">Coach</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
        active ? "bg-accent/10 text-ink" : "text-muted hover:bg-black/[0.04] hover:text-ink",
      )}
    >
      <MessageCircle className={cn("h-4 w-4", active ? "text-accent" : "text-faint")} />
      Coach
    </button>
  );
}
