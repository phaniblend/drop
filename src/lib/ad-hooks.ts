import "server-only";

import { env, integrationStatus } from "./env";

export type AdHookAngle = {
  id: "pain" | "curiosity" | "price";
  label: string;
  hook: string;
  script: string;
};

function localHooks(input: { title: string; description: string; benefits: string; price: number }): AdHookAngle[] {
  const name = input.title.trim() || "this product";
  const price = input.price > 0 ? `$${input.price.toFixed(2)}` : "the price on screen";
  const benefit = input.benefits.split(/[.\n]/)[0]?.trim() || "it actually solves the annoying part of the day";
  return [
    {
      id: "pain",
      label: "Pain-Agitate-Solve",
      hook: `Stop wasting money on ${name.toLowerCase()} that looks good in the ad and dies in a week.`,
      script: `Hook: You know that moment when ${benefit.toLowerCase()}... and then it doesn't.\nAgitate: Cheap versions fail in 10 days and you are back in the same loop.\nSolve: ${name} is the one we kept after killing three losers. ${price}, shipped. Comment "link" if you want the exact SKU.`,
    },
    {
      id: "curiosity",
      label: "Visual Curiosity / Unboxing",
      hook: `Don't blink — the first 3 seconds of this unboxing is why this ${name.toLowerCase()} keeps getting stolen from my desk.`,
      script: `Hook: Watch me unpack ${name} with no talking for 3 seconds.\nHold: Then I show the one detail the cheap copies skip.\nPayoff: ${benefit}. ${price}. Follow for the supplier-to-store version.`,
    },
    {
      id: "price",
      label: "Price-Anchor / Comparison",
      hook: `Same job as the $40 version. This one is ${price}. I'll show the side-by-side.`,
      script: `Hook: Retailers want ${price.replace("$", "$")}×3 for ${name}.\nCompare: Same core function, cleaner listing, landed cost that still leaves room for ads.\nCTA: I listed it at ${price}. Steal the angle, don't steal the supplier markup.`,
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
  if (!integrationStatus().ai) {
    return { hooks: fallback, mode: "local" as const };
  }

  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.aiGatewayKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.aiModel,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You write short-form paid social scripts for dropshippers. Return JSON only: {hooks:[{id,label,hook,script}]}. ids must be pain, curiosity, price. hook is one spoken sentence. script is 4-7 short lines.",
          },
          {
            role: "user",
            content: `Title: ${input.title}\nPrice: ${input.price}\nBenefits: ${input.benefits}\nDescription: ${input.description.slice(0, 800)}`,
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
