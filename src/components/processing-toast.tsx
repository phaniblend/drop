"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PROCESSING_EVENT } from "@/lib/processing";

export function ProcessingToast() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const next = (e as CustomEvent<{ text?: string | null }>).detail?.text;
      setText(typeof next === "string" && next.trim() ? next : null);
    };
    window.addEventListener(PROCESSING_EVENT, on);
    return () => window.removeEventListener(PROCESSING_EVENT, on);
  }, []);

  if (!text) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-ink px-4 py-2 text-xs text-white shadow-lg md:bottom-6"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {text}
    </div>
  );
}
