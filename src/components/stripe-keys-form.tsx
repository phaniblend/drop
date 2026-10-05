"use client";

import { useEffect, useState, useTransition } from "react";
import { saveStoreStripeKeys } from "@/app/actions/settings";
import { Button, Card, CardHeader, Field, inputClass } from "./ui";

export const STRIPE_KEYS_PROMPT = "seto-stripe-keys-prompt";

export function promptStoreStripeKeys() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STRIPE_KEYS_PROMPT));
}

export function StripeKeysForm({
  publishableMasked = "",
  secretMasked = "",
  mode = "off",
  onSaved,
}: {
  publishableMasked?: string;
  secretMasked?: string;
  mode?: "off" | "test" | "live";
  onSaved?: () => void;
}) {
  const [pending, start] = useTransition();
  const [pk, setPk] = useState("");
  const [sk, setSk] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  return (
    <Card id="stripe">
      <CardHeader
        eyebrow="Store payments"
        title="Stripe keys"
        action={
          <span className="text-xs text-muted">
            {mode === "live" ? "Live" : mode === "test" ? "Sandbox" : "Not set"}
          </span>
        }
      />
      <form
        className="space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg("");
          setErr("");
          start(async () => {
            const res = await saveStoreStripeKeys({ publishableKey: pk, secretKey: sk });
            if (!res.ok) {
              setErr(res.error);
              return;
            }
            setMsg(res.message);
            setPk("");
            setSk("");
            onSaved?.();
          });
        }}
      >
        <p className="text-sm text-muted">
          Add your <strong className="font-medium text-ink">live</strong> Stripe keys so shoppers pay you,
          not the platform sandbox. Keys stay on this store only.
        </p>
        {publishableMasked || secretMasked ? (
          <p className="text-xs text-faint">
            Saved {publishableMasked || "pk_…"} / {secretMasked || "sk_…"}
          </p>
        ) : null}
        <Field label="Publishable key">
          <input
            className={inputClass}
            value={pk}
            onChange={(e) => setPk(e.target.value)}
            placeholder="pk_live_…"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Field label="Secret key">
          <input
            className={inputClass}
            type="password"
            value={sk}
            onChange={(e) => setSk(e.target.value)}
            placeholder="sk_live_…"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        {err ? <p className="text-sm text-loss">{err}</p> : null}
        {msg ? <p className="text-sm text-profit">{msg}</p> : null}
        <Button type="submit" tone="accent" disabled={pending || !pk.trim() || !sk.trim()}>
          {pending ? "Checking keys…" : "Save live Stripe keys"}
        </Button>
      </form>
    </Card>
  );
}

export function StripeKeysPrompt({
  live,
  autoOpen = false,
  publishableMasked = "",
  secretMasked = "",
  mode = "off",
}: {
  live: boolean;
  autoOpen?: boolean;
  publishableMasked?: string;
  secretMasked?: string;
  mode?: "off" | "test" | "live";
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (live) {
      setOpen(false);
      return;
    }
    if (autoOpen) setOpen(true);
    function onPrompt() {
      setOpen(true);
    }
    window.addEventListener(STRIPE_KEYS_PROMPT, onPrompt);
    return () => window.removeEventListener(STRIPE_KEYS_PROMPT, onPrompt);
  }, [live, autoOpen]);

  if (live || !open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="w-full max-w-lg">
        <StripeKeysForm
          publishableMasked={publishableMasked}
          secretMasked={secretMasked}
          mode={mode}
          onSaved={() => setOpen(false)}
        />
        <button type="button" className="mt-3 w-full text-center text-sm text-white/90" onClick={() => setOpen(false)}>
          Skip for now — I will stay in sandbox
        </button>
      </div>
    </div>
  );
}
