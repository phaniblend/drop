import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

function stripeForm(body: Record<string, string>) {
  return new URLSearchParams(body);
}

export async function stripePost<T>(path: string, body: Record<string, string>) {
  if (!env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: stripeForm(body),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe ${res.status}`);
  }
  return json;
}

export async function stripeGet<T>(path: string) {
  if (!env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      "Stripe-Version": "2024-06-20",
    },
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe ${res.status}`);
  }
  return json;
}

export function appOrigin() {
  return env.appUrl.replace(/\/$/, "");
}

export function verifyStripeSignature(rawBody: string, header: string | null) {
  if (!env.stripeWebhookSecret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((piece) => {
      const [k, ...rest] = piece.split("=");
      return [k.trim(), rest.join("=")];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const expected = createHmac("sha256", env.stripeWebhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
