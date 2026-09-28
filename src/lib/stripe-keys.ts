export type StripeKeyMode = "off" | "test" | "live";

export function stripeKeyMode(key?: string | null): StripeKeyMode {
  const value = (key ?? "").trim();
  if (!value) return "off";
  if (/^(pk|sk|rk)_test_/.test(value)) return "test";
  if (/^(pk|sk|rk)_live_/.test(value)) return "live";
  return "off";
}

export function classifyStripeKeyPair(publishableKey: string, secretKey: string) {
  const pk = publishableKey.trim();
  const sk = secretKey.trim();
  if (!pk && !sk) {
    return { ok: false as const, mode: "off" as const, error: "Enter your live Stripe keys." };
  }
  if (!pk.startsWith("pk_") || !sk.startsWith("sk_")) {
    return {
      ok: false as const,
      mode: "off" as const,
      error: "Use a publishable key (pk_…) and a secret key (sk_…).",
    };
  }
  const pkMode = stripeKeyMode(pk);
  const skMode = stripeKeyMode(sk);
  if (pkMode === "off" || skMode === "off") {
    return { ok: false as const, mode: "off" as const, error: "Those keys do not look like Stripe API keys." };
  }
  if (pkMode !== skMode) {
    return {
      ok: false as const,
      mode: "off" as const,
      error: "Publishable and secret keys must both be live, or both be test.",
    };
  }
  return { ok: true as const, mode: pkMode, error: null };
}

export function maskStripeKey(key?: string | null) {
  const value = (key ?? "").trim();
  if (value.length < 12) return "";
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}
