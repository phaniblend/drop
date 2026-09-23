import "server-only";

import { geminiGenerate, parseJsonObject } from "./gemini";
import { formatGeminiFallback } from "./copy-local";
import { recordGeminiCall } from "./gemini-health";
import { extractProductBeats, spokenProductName } from "./product-title";
import { normalizeHookScript } from "./format-script";
import { env } from "./env";

export type AdHookAngle = {
  id: "pain" | "curiosity" | "price";
  label: string;
  hook: string;
  script: string;
};

function localHooks(input: { title: string; description: string; benefits: string; price: number }): AdHookAngle[] {
  const name = spokenProductName(input.title);
  const price = input.price > 0 ? `$${input.price.toFixed(2)}` : "the price on screen";
  const beats = extractProductBeats({
    title: input.title,
    description: `${input.description} ${input.benefits}`,
  });
  const primary = beats[0];
  const secondary = beats[1];

  return [
    {
      id: "pain" as const,
      label: "Pain-Agitate-Solve",
      hook: `Still stuck with the old way? Watch this ${name} fix it.`,
      script: normalizeHookScript(
        `Hook: You know that annoying moment — ${primary} — and it fails again.\nAgitate: Cheap versions look fine in the ad and quit in a week.\nSolve: This ${name} is the one we kept after killing three losers — ${secondary}.\nOffer: ${price}, shipped. Comment "link" if you want the exact product.`,
      ),
    },
    {
      id: "curiosity" as const,
      label: "Visual Curiosity / Unboxing",
      hook: `Don't blink — the first 3 seconds show why this ${name} keeps getting stolen off my desk.`,
      script: normalizeHookScript(
        `Hook: Silent unboxing of this ${name} for 3 seconds.\nHold: Then the one detail cheap copies skip — ${primary}.\nPayoff: ${secondary}. ${price}. Follow for the supplier-to-store version.`,
      ),
    },
    {
      id: "price" as const,
      label: "Price-Anchor / Comparison",
      hook: `Same job as the $40 aisle version. This ${name} is ${price}.`,
      script: normalizeHookScript(
        `Hook: Retail wants triple-digit money for a ${name}.\nCompare: Same core job, cleaner listing, room left for ads after fees.\nProof: ${primary}.\nCTA: Live at ${price}. Steal the angle — not the markup.`,
      ),
    },
  ];
}

function normalizeHooks(raw: Array<Partial<AdHookAngle> & { script?: unknown }>): AdHookAngle[] {
  return raw
    .map((h) => ({
      id: h.id as AdHookAngle["id"],
      label: String(h.label || h.id || "Angle"),
      hook: String(h.hook || "").trim(),
      script: normalizeHookScript(h.script),
    }))
    .filter((h) => h.hook && h.script && ["pain", "curiosity", "price"].includes(h.id));
}

export async function generateAdHooks(input: {
  title: string;
  description: string;
  benefits: string;
  price: number;
}) {
  const fallback = localHooks(input);
  if (!env.geminiApiKey) {
    return {
      hooks: fallback,
      mode: "local" as const,
      reason: formatGeminiFallback("GEMINI_API_KEY is not set"),
    };
  }

  try {
    const spoken = spokenProductName(input.title);
    const beats = extractProductBeats({
      title: input.title,
      description: `${input.description} ${input.benefits}`,
    });
    const result = await geminiGenerate({
      temperature: 0.75,
      system:
        "You write short-form paid social scripts for dropshippers. Return JSON only: {hooks:[{id,label,hook,script}]}. ids must be pain, curiosity, price. hook is one spoken sentence. script is an array of 4-7 short lines (or a single string with newlines). Use the short product name from Short name — never invent a different product noun and never paste long wholesale titles. Ground every angle in real benefits.",
      user: `Short name (use this noun): ${spoken}\nFinal title: ${input.title}\nPrice: ${input.price}\nBenefits: ${beats.join("; ")}\nDescription: ${input.description.slice(0, 800)}`,
    });
    await recordGeminiCall(result);

    if (!result.text) {
      return {
        hooks: fallback,
        mode: "local" as const,
        reason: formatGeminiFallback(result.error),
      };
    }
    const parsed = parseJsonObject<{ hooks?: Array<Partial<AdHookAngle> & { script?: unknown }> }>(
      result.text,
    );
    const hooks = normalizeHooks(parsed?.hooks ?? []);
    if (hooks.length < 3) {
      return {
        hooks: fallback,
        mode: "local" as const,
        reason: formatGeminiFallback("model returned fewer than 3 hooks"),
      };
    }
    return { hooks: hooks.slice(0, 3), mode: "ai" as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[generateAdHooks]", msg);
    return {
      hooks: fallback,
      mode: "local" as const,
      reason: formatGeminiFallback(msg),
    };
  }
}
