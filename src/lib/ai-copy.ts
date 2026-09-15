import "server-only";

import { env, integrationStatus } from "./env";

const JUNK = [
  /\bwholesale\b/gi,
  /\bdropshipping\b/gi,
  /\bdropship\b/gi,
  /\bhot sale\b/gi,
  /\bnew 20\d{2}\b/gi,
  /\bfactory\b/gi,
  /\bfree shipping\b/gi,
  /\bready to ship\b/gi,
];

export function localCleanTitle(raw: string) {
  let next = raw;
  for (const re of JUNK) next = next.replace(re, " ");
  next = next.replace(/[|/]+/g, " ").replace(/\s+/g, " ").trim();
  return next
    .split(" ")
    .slice(0, 7)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function localDescription(title: string, extras: string[]) {
  return `<p>${title} is designed for daily use — simple setup, clean look, and a price that still leaves room for ads.</p><ul>${extras.map((e) => `<li>${e}</li>`).join("")}<li>Tracked shipping</li><li>Easy returns if it doesn't land</li></ul>`;
}

export async function enrichCopy(input: {
  rawTitle: string;
  cost: number;
  shipping: number;
  niche?: string;
}) {
  const fallbackTitle = localCleanTitle(input.rawTitle);
  const fallbackHtml = localDescription(fallbackTitle, [
    `Landed cost about $${(input.cost + input.shipping).toFixed(2)}`,
    input.niche ? `Positioned for ${input.niche} shoppers` : "Impulse-friendly creative angle",
  ]);

  const live = integrationStatus();
  if (!live.ai) {
    return { title: fallbackTitle, descriptionHtml: fallbackHtml, mode: "local" as const };
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
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You write conversion-focused dropshipping product copy. Return JSON {title, descriptionHtml}. Title max 6 words, no wholesale language. Description is short HTML with a paragraph and 4 bullets.",
          },
          {
            role: "user",
            content: `Raw title: ${input.rawTitle}\nNiche: ${input.niche ?? "general"}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      return { title: fallbackTitle, descriptionHtml: fallbackHtml, mode: "local" as const };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim()) as {
      title?: string;
      descriptionHtml?: string;
    };
    return {
      title: parsed.title || fallbackTitle,
      descriptionHtml: parsed.descriptionHtml || fallbackHtml,
      mode: "ai" as const,
    };
  } catch {
    return { title: fallbackTitle, descriptionHtml: fallbackHtml, mode: "local" as const };
  }
}
