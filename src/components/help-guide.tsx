"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleHelp, GripVertical, X } from "lucide-react";
import { HELP_STEPS } from "@/lib/help-steps";
import { Button } from "./ui";
import { cn } from "@/lib/utils";

const STEP_KEY = "dropshipos-help-step-v2";
const OPEN_KEY = "dropshipos-help-open";
const POS_KEY = "dropshipos-help-pos-v3";
const CARD_MAX = 300;

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
  const maxY = Math.max(8, window.innerHeight - (mobile ? 220 : 96));
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
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const saved = Number(window.sessionStorage.getItem(STEP_KEY) ?? "0");
    if (Number.isFinite(saved) && saved >= 0 && saved < HELP_STEPS.length) {
      setIndex(saved);
    }
    const rawPos = window.sessionStorage.getItem(POS_KEY);
    if (rawPos) {
      try {
        const parsed = JSON.parse(rawPos) as { x: number; y: number };
        if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) setPos(clampPos(parsed));
      } catch {
        /* use CSS default */
      }
    }
    if (window.sessionStorage.getItem(OPEN_KEY) === "1") {
      onOpenChange(true);
    }
    setReady(true);
    const onResize = () => setPos((p) => (p ? clampPos(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(STEP_KEY, String(index));
  }, [index]);

  useEffect(() => {
    window.sessionStorage.setItem(OPEN_KEY, open ? "1" : "0");
  }, [open]);

  useEffect(() => {
    if (!ready || !pos) return;
    window.sessionStorage.setItem(POS_KEY, JSON.stringify(pos));
  }, [pos, ready]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
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

  const step = HELP_STEPS[index];
  const last = index === HELP_STEPS.length - 1;
  const first = index === 0;

  return (
    <aside
      className="fixed top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] right-3 z-[100] w-[min(18.75rem,calc(100vw-1rem))] rounded-2xl border border-line bg-surface shadow-[0_18px_50px_rgba(15,18,34,0.12)] md:right-6"
      style={pos ? { left: pos.x, top: pos.y, right: "auto" } : undefined}
      role="dialog"
      aria-label="Daily workflow help"
      aria-modal="false"
    >
      <div
        className="flex cursor-grab items-center justify-between border-b border-line px-3 py-2 active:cursor-grabbing"
        role="toolbar"
        aria-label="Move help"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          <GripVertical className="h-3.5 w-3.5 text-faint" />
          Help
        </p>
        <button
          type="button"
          className="rounded-md p-1 text-muted hover:bg-black/[0.04] hover:text-ink"
          onClick={() => onOpenChange(false)}
          aria-label="Hide help"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Step {index + 1} of {HELP_STEPS.length}
        </p>
        <h2 className="mt-1 text-sm font-semibold text-ink">{step.label}</h2>
        <p className="mt-2 text-xs leading-5 text-muted">{step.desc}</p>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <Button
          tone="line"
          className="h-8 flex-1 px-2 text-xs"
          disabled={first}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Button>
        <Button
          tone="accent"
          className="h-8 flex-1 px-2 text-xs"
          disabled={last}
          onClick={() => setIndex((i) => Math.min(HELP_STEPS.length - 1, i + 1))}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </aside>
  );
}

export function HelpMenuButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
        active
          ? "bg-accent/10 text-ink"
          : "text-muted hover:bg-black/[0.04] hover:text-ink",
      )}
    >
      <CircleHelp className={cn("h-4 w-4", active ? "text-accent" : "text-faint")} />
      Help
    </button>
  );
}
