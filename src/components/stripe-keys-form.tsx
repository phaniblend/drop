"use client";

import { useEffect, useState, useTransition } from "react";
import { saveStoreStripeKeys } from "@/app/actions/settings";
import { Button, Card, CardHeader, Field, inputClass } from "./ui";

export function StripeKeysForm({
  publishableMasked = "",
  secretMasked = "",
  mode = "off",
}: {
  publishableMasked?: string;
  secretMasked?: string;
  mode?: "off" | "test" | "live";
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

export function StripeSandboxBanner() {
  return (
    <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 sm:px-5">
      <p className="text-sm font-medium text-ink">Your store is currently running in Stripe Sandbox mode.</p>
      <p className="mt-1 text-sm text-muted">
        Add your live Stripe keys to accept real customer payments.
      </p>
      <a href="/settings#stripe" className="mt-2 inline-block text-sm text-accent">
        Add live Stripe keys →
      </a>
    </div>
  );
}

export function StripeOnboardingGate({
  live,
  publishableMasked = "",
  secretMasked = "",
  mode = "off",
}: {
  live: boolean;
  publishableMasked?: string;
  secretMasked?: string;
  mode?: "off" | "test" | "live";
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (live) return;
    if (window.sessionStorage.getItem("seto-stripe-setup") === "1") return;
    setOpen(true);
  }, [live]);

  function dismiss() {
    window.sessionStorage.setItem("seto-stripe-setup", "1");
    setOpen(false);
  }

  return (
    <>
      {live ? null : <StripeSandboxBanner />}
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-lg">
            <StripeKeysForm
              publishableMasked={publishableMasked}
              secretMasked={secretMasked}
              mode={mode}
            />
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-white/90"
              onClick={dismiss}
            >
              Skip for now — I will stay in sandbox
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
