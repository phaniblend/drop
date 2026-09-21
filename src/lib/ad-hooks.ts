import "server-only";

import { env, integrationStatus } from "./env";
import { spokenProductName } from "./product-title";

export type AdHookAngle = {
  id: "pain" | "curiosity" | "price";
  label: string;
  hook: string;
  script: string;
};

function localHooks(input: { title: string; description: string; benefits: string; price: number }): AdHookAngle[] {
  const name = spokenProductName(input.title);
  const price = input.price > 0 ? `$${input.price.toFixed(2)}` : "the price on screen";
  const benefit =
    input.benefits.split(/[.\n]/)[0]?.trim() ||
    "it actually solves the annoying part of the day";
  const painThing = /fan|lamp|light|sign|holder|organizer|case|kit|bracelet|watch|camera/i.test(name)
    ? name
    : `${name} gadgets`;
  return [
    {
      id: "pain",
      label: "Pain-Agitate-Solve",
      hook: `Stop buying ${painThing.toLowerCase()} that look perfect in the ad and fall apart in a week.`,
      script: `Hook: You know that moment when ${benefit.toLowerCase()}... and then it doesn't.\nAgitate: Cheap versions fail in 10 days and you are back in the same loop.\nSolve: This ${name} is the one we kept after killing three losers. ${price}, shipped. Comment "link" if you want the exact product.`,
    },
    {
      id: "curiosity",
      label: "Visual Curiosity / Unboxing",
      hook: `Don't blink — the first 3 seconds of this unboxing is why this ${name.toLowerCase()} keeps getting stolen from my desk.`,
      script: `Hook: Watch me unpack this ${name} with no talking for 3 seconds.\nHold: Then I show the one detail the cheap copies skip.\nPayoff: ${benefit}. ${price}. Follow for the supplier-to-store version.`,
    },
    {
      id: "price",
      label: "Price-Anchor / Comparison",
      hook: `Same job as the $40 version. This one is ${price}. I'll show the side-by-side.`,
      script: `Hook: Retailers want triple ${price} for a ${name}.\nCompare: Same core function, cleaner listing, a supplier price that still leaves room for ads.\nCTA: I listed it at ${price}. Steal the angle, don't steal the supplier markup.`,
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
    const spoken = spokenProductName(input.title);
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
              "You write short-form paid social scripts for dropshippers. Return JSON only: {hooks:[{id,label,hook,script}]}. ids must be pain, curiosity, price. hook is one spoken sentence. script is 4-7 short lines. Never paste long wholesale titles — use the short product name. Rewrite around real benefits, not mail-merge templates.",
          },
          {
            role: "user",
            content: `Short name: ${spoken}\nRaw title: ${input.title}\nPrice: ${input.price}\nBenefits: ${input.benefits}\nDescription: ${input.description.slice(0, 800)}`,
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
