"use client";

import { useEffect, useState } from "react";

const KEY = "seto_cookie_consent_v1";

export function StoreCookieNotice({ hasPixel = false }: { hasPixel?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface p-4 shadow-[0_-8px_30px_rgba(15,18,34,0.12)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          We use essential cookies for checkout
          {hasPixel
            ? " and may use advertising cookies (e.g. Meta Pixel) to measure ad performance after you accept."
            : "."}{" "}
          See Privacy for details.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink"
            onClick={() => {
              try {
                localStorage.setItem(KEY, "essential");
              } catch {
                /* ignore */
              }
              setVisible(false);
              window.dispatchEvent(new CustomEvent("seto-cookie-consent", { detail: "essential" }));
            }}
          >
            Essential only
          </button>
          <button
            type="button"
            className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white"
            onClick={() => {
              try {
                localStorage.setItem(KEY, "all");
              } catch {
                /* ignore */
              }
              setVisible(false);
              window.dispatchEvent(new CustomEvent("seto-cookie-consent", { detail: "all" }));
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
