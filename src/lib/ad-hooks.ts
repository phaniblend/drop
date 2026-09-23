import "server-only";

import { geminiGenerate, parseJsonObject } from "./gemini";
import { formatGeminiFallback } from "./copy-local";
import { recordGeminiCall } from "./gemini-health";
import { extractProductBeats, spokenProductName } from "./product-title";
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
  // beats are clause fragments (e.g. "machine-washable so it stays clean…")
  const primary = beats[0];
  const secondary = beats[1];

  return [
    {
      id: "pain",
      label: "Pain-Agitate-Solve",
      hook: `Still stuck with the old way? Watch this ${name} fix it.`,
      script: `Hook: You know that annoying moment — ${primary} — and it fails again.\nAgitate: Cheap versions look fine in the ad and quit in a week.\nSolve: This ${name} is the one we kept after killing three losers — ${secondary}.\nOffer: ${price}, shipped. Comment "link" if you want the exact product.`,
    },
    {
      id: "curiosity",
      label: "Visual Curiosity / Unboxing",
      hook: `Don't blink — the first 3 seconds show why this ${name} keeps getting stolen off my desk.`,
      script: `Hook: Silent unboxing of this ${name} for 3 seconds.\nHold: Then the one detail cheap copies skip — ${primary}.\nPayoff: ${secondary}. ${price}. Follow for the supplier-to-store version.`,
    },
    {
      id: "price",
      label: "Price-Anchor / Comparison",
      hook: `Same job as the $40 aisle version. This ${name} is ${price}.`,
      script: `Hook: Retail wants triple-digit money for a ${name}.\nCompare: Same core job, cleaner listing, room left for ads after fees.\nProof: ${primary}.\nCTA: Live at ${price}. Steal the angle — not the markup.`,
    },
  ];
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
        "You write short-form paid social scripts for dropshippers. Return JSON only: {hooks:[{id,label,hook,script}]}. ids must be pain, curiosity, price. hook is one spoken sentence. script is 4-7 short lines. Use the short product name only — never paste long wholesale titles. Ground every angle in real benefits. Do not mail-merge the raw title into a fixed sentence.",
      user: `Short name: ${spoken}\nRaw title: ${input.title}\nPrice: ${input.price}\nBenefits: ${beats.join("; ")}\nDescription: ${input.description.slice(0, 800)}`,
    });
    await recordGeminiCall(result);

    if (!result.text) {
      return {
        hooks: fallback,
        mode: "local" as const,
        reason: formatGeminiFallback(result.error),
      };
    }
    const parsed = parseJsonObject<{ hooks?: AdHookAngle[] }>(result.text);
    const hooks = (parsed?.hooks ?? []).filter((h) => h.hook && h.script);
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
