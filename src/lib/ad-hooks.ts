import "server-only";

import { env, integrationStatus } from "./env";
import { extractProductBeats, spokenProductName } from "./product-title";

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
      id: "pain",
      label: "Pain-Agitate-Solve",
      hook: `If you are still dealing with this the hard way, watch this ${name.toLowerCase()} fix.`,
      script: `Hook: That annoying moment when ${primary}… fails again.\nAgitate: Cheap versions look fine in the ad and quit in a week.\nSolve: This ${name} is the one we kept after killing three losers — ${secondary}.\nOffer: ${price}, shipped. Comment "link" if you want the exact product.`,
    },
    {
      id: "curiosity",
      label: "Visual Curiosity / Unboxing",
      hook: `Don't blink — the first 3 seconds show why this ${name.toLowerCase()} keeps getting stolen off my desk.`,
      script: `Hook: Silent unboxing of this ${name} for 3 seconds.\nHold: Then the one detail cheap copies skip — ${primary}.\nPayoff: ${secondary}. ${price}. Follow for the supplier-to-store version.`,
    },
    {
      id: "price",
      label: "Price-Anchor / Comparison",
      hook: `Same job as the $40 aisle version. This ${name.toLowerCase()} is ${price}.`,
      script: `Hook: Retail wants triple digit money for a ${name}.\nCompare: Same core job, cleaner listing, room left for ads after fees.\nProof: ${primary}.\nCTA: Live at ${price}. Steal the angle — not the markup.`,
    },
  ];
}

function parseModelJson(content: string) {
  const trimmed = content.replace(/```json|```/g, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const slice = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  return JSON.parse(slice) as { hooks?: AdHookAngle[] };
}

export async function generateAdHooks(input: {
  title: string;
  description: string;
  benefits: string;
  price: number;
}) {
  const fallback = localHooks(input);
  if (!integrationStatus().ai || !env.aiGatewayKey) {
    return { hooks: fallback, mode: "local" as const };
  }

  try {
    const spoken = spokenProductName(input.title);
    const beats = extractProductBeats({
      title: input.title,
      description: `${input.description} ${input.benefits}`,
    });
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.aiGatewayKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.aiModel,
        temperature: 0.75,
        messages: [
          {
            role: "system",
            content:
              "You write short-form paid social scripts for dropshippers. Return JSON only: {hooks:[{id,label,hook,script}]}. ids must be pain, curiosity, price. hook is one spoken sentence. script is 4-7 short lines. Use the short product name only — never paste long wholesale titles. Ground every angle in real benefits. Do not mail-merge the raw title into a fixed sentence.",
          },
          {
            role: "user",
            content: `Short name: ${spoken}\nRaw title: ${input.title}\nPrice: ${input.price}\nBenefits: ${beats.join("; ")}\nDescription: ${input.description.slice(0, 800)}`,
          },
        ],
      }),
    });
    if (!res.ok) return { hooks: fallback, mode: "local" as const };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = parseModelJson(json.choices?.[0]?.message?.content ?? "");
    const hooks = (parsed.hooks ?? []).filter((h) => h.hook && h.script);
    if (hooks.length < 3) return { hooks: fallback, mode: "local" as const };
    return { hooks: hooks.slice(0, 3), mode: "ai" as const };
  } catch {
    return { hooks: fallback, mode: "local" as const };
  }
}
