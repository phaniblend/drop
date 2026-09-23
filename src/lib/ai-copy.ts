import "server-only";

import { geminiGenerate, parseJsonObject } from "./gemini";
import { formatGeminiFallback, localCleanTitle as cleanTitle } from "./copy-local";
import { recordGeminiCall } from "./gemini-health";
import { extractProductBeats, spokenProductName } from "./product-title";
import { env } from "./env";

export function localCleanTitle(raw: string, currentTitle?: string) {
  return cleanTitle(raw, currentTitle, spokenProductName);
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
  // beats are noun-phrase / clause fragments — lead with a full sentence.
  const lead = `${input.title} is built for everyday use — ${beats[0]}.`;
  const bullets = [
    beats[1],
    beats[2],
    beats[3] ?? "Tracked shipping with a clear return path if it does not land",
  ];
  return `<p>${lead}</p><ul>${bullets.map((e) => `<li>${e.charAt(0).toUpperCase()}${e.slice(1)}</li>`).join("")}</ul>`;
}

export type EnrichCopyResult = {
  title: string;
  descriptionHtml: string;
  mode: "ai" | "local";
  reason?: string;
  /** When mode is local, title/description are suggestions — caller must not auto-apply title. */
  applyTitle: boolean;
};

export async function enrichCopy(input: {
  rawTitle: string;
  cost: number;
  shipping: number;
  niche?: string;
  currentTitle?: string;
  descriptionHint?: string;
}): Promise<EnrichCopyResult> {
  const fallbackTitle = localCleanTitle(input.rawTitle, input.currentTitle);
  const fallbackHtml = localDescription({
    title: fallbackTitle,
    rawTitle: input.rawTitle,
    cost: input.cost,
    shipping: input.shipping,
    niche: input.niche,
    descriptionHint: input.descriptionHint,
  });

  if (!env.geminiApiKey) {
    return {
      title: fallbackTitle,
      descriptionHtml: fallbackHtml,
      mode: "local",
      reason: formatGeminiFallback("GEMINI_API_KEY is not set"),
      applyTitle: false,
    };
  }

  try {
    const beats = extractProductBeats({
      title: input.rawTitle,
      description: input.descriptionHint,
      niche: input.niche,
    });
    const result = await geminiGenerate({
      temperature: 0.55,
      system:
        "You write conversion-focused dropshipping product copy. Return JSON only: {title, descriptionHtml}. Title max 6 words, no wholesale brand codes, no year spam. Description is short HTML: one paragraph plus exactly 4 unique benefit bullets grounded in the product — the opening sentence MUST use the same final title you return. Never generic lines like 'you pay about' or 'positioned for shoppers'.",
      user: `Raw title: ${input.rawTitle}\nShort name hint: ${fallbackTitle}\nNiche: ${input.niche ?? "general"}\nSupplier cost: $${(input.cost + input.shipping).toFixed(2)}\nKnown beats: ${beats.join("; ")}\nExisting description hint: ${(input.descriptionHint ?? "").slice(0, 500)}\nWrite descriptionHtml using your returned title as the product name.`,
    });
    await recordGeminiCall(result);

    if (!result.text) {
      return {
        title: fallbackTitle,
        descriptionHtml: fallbackHtml,
        mode: "local",
        reason: formatGeminiFallback(result.error),
        applyTitle: false,
      };
    }
    const parsed = parseJsonObject<{ title?: string; descriptionHtml?: string }>(result.text);
    if (!parsed) {
      return {
        title: fallbackTitle,
        descriptionHtml: fallbackHtml,
        mode: "local",
        reason: formatGeminiFallback("could not parse model JSON"),
        applyTitle: false,
      };
    }
    const title = (parsed.title || fallbackTitle).trim();
    let descriptionHtml = parsed.descriptionHtml || fallbackHtml;
    // Keep body in sync with the final title (model often rewrites title only).
    const oldHints = [input.currentTitle, input.rawTitle, fallbackTitle]
      .map((t) => t?.trim())
      .filter((t): t is string => Boolean(t && t !== title));
    for (const old of oldHints) {
      if (old.length >= 4 && descriptionHtml.includes(old)) {
        descriptionHtml = descriptionHtml.split(old).join(title);
      }
    }
    const lead = localDescription({
      title,
      rawTitle: input.rawTitle,
      cost: input.cost,
      shipping: input.shipping,
      niche: input.niche,
      descriptionHint: descriptionHtml,
    });
    // If description still leads with a different product name, prefer a title-aligned local body.
    if (!descriptionHtml.toLowerCase().includes(title.toLowerCase().slice(0, Math.min(12, title.length)))) {
      descriptionHtml = lead;
    }
    return {
      title,
      descriptionHtml,
      mode: "ai",
      applyTitle: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[enrichCopy]", msg);
    return {
      title: fallbackTitle,
      descriptionHtml: fallbackHtml,
      mode: "local",
      reason: formatGeminiFallback(msg),
      applyTitle: false,
    };
  }
}
