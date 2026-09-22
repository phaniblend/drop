import "server-only";

import { integrationStatus } from "./env";
import { geminiGenerate, parseJsonObject } from "./gemini";
import { extractProductBeats, spokenProductName } from "./product-title";

const JUNK = [
  /\bwholesale\b/gi,
  /\bdropshipping\b/gi,
  /\bdropship\b/gi,
  /\bhot sale\b/gi,
  /\bnew 20\d{2}\b/gi,
  /\bfactory\b/gi,
  /\bfree shipping\b/gi,
  /\bready to ship\b/gi,
  /\bgarvee\b/gi,
];

function titleCaseWords(words: string[]) {
  return words
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function localCleanTitle(raw: string, currentTitle?: string) {
  let next = raw;
  for (const re of JUNK) next = next.replace(re, " ");
  next = next.replace(/[|/]+/g, " ").replace(/\s+/g, " ").trim();
  const spoken = spokenProductName(next);
  if (spoken && spoken !== "this product" && spoken !== currentTitle) {
    return titleCaseWords(spoken.split(" "));
  }
  const words = next.split(" ").filter((w) => w.length > 1 && !/^\d+(\.\d+)?$/.test(w));
  const candidates = [
    titleCaseWords(words.slice(0, 6)),
    titleCaseWords(words.filter((w) => !/^\d/.test(w)).slice(0, 6)),
    titleCaseWords(words.slice(1, 7)),
  ].filter((title) => title.length > 3);
  return candidates.find((title) => title !== currentTitle) ?? candidates[0] ?? titleCaseWords(words.slice(0, 6));
}

export function localDescription(input: {
  title: string;
  rawTitle: string;
  cost: number;
  shipping: number;
  niche?: string;
  descriptionHint?: string;
}) {
  const beats = extractProductBeats({
    title: `${input.title} ${input.rawTitle}`,
    description: input.descriptionHint,
    niche: input.niche,
  });
  const lead = `${input.title} is built for everyday use — ${beats[0]}.`;
  const bullets = [
    beats[1],
    beats[2],
    beats[3] ?? "Tracked shipping with a clear return path if it does not land",
  ];
  return `<p>${lead}</p><ul>${bullets.map((e) => `<li>${e.charAt(0).toUpperCase()}${e.slice(1)}</li>`).join("")}</ul>`;
}

export async function enrichCopy(input: {
  rawTitle: string;
  cost: number;
  shipping: number;
  niche?: string;
  currentTitle?: string;
  descriptionHint?: string;
}) {
  const fallbackTitle = localCleanTitle(input.rawTitle, input.currentTitle);
  const fallbackHtml = localDescription({
    title: fallbackTitle,
    rawTitle: input.rawTitle,
    cost: input.cost,
    shipping: input.shipping,
    niche: input.niche,
    descriptionHint: input.descriptionHint,
  });

  if (!integrationStatus().ai) {
    return { title: fallbackTitle, descriptionHtml: fallbackHtml, mode: "local" as const };
  }

  try {
    const beats = extractProductBeats({
      title: input.rawTitle,
      description: input.descriptionHint,
      niche: input.niche,
    });
    const content = await geminiGenerate({
      temperature: 0.55,
      system:
        "You write conversion-focused dropshipping product copy. Return JSON only: {title, descriptionHtml}. Title max 6 words, no wholesale brand codes, no year spam. Description is short HTML: one paragraph plus exactly 4 unique benefit bullets grounded in the product — never generic lines like 'you pay about' or 'positioned for shoppers'.",
      user: `Raw title: ${input.rawTitle}\nShort name hint: ${fallbackTitle}\nNiche: ${input.niche ?? "general"}\nSupplier cost: $${(input.cost + input.shipping).toFixed(2)}\nKnown beats: ${beats.join("; ")}\nExisting description hint: ${(input.descriptionHint ?? "").slice(0, 500)}`,
    });
    if (!content) {
      return { title: fallbackTitle, descriptionHtml: fallbackHtml, mode: "local" as const };
    }
    const parsed = parseJsonObject<{ title?: string; descriptionHtml?: string }>(content);
    if (!parsed) {
      return { title: fallbackTitle, descriptionHtml: fallbackHtml, mode: "local" as const };
    }
    return {
      title: parsed.title || fallbackTitle,
      descriptionHtml: parsed.descriptionHtml || fallbackHtml,
      mode: "ai" as const,
    };
  } catch {
    return { title: fallbackTitle, descriptionHtml: fallbackHtml, mode: "local" as const };
  }
}
