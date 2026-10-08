import "server-only";

import { geminiGenerate, parseJsonObject } from "./gemini";
import { formatGeminiFallback, localCleanTitle as cleanTitle } from "./copy-local";
import { recordGeminiCall } from "./gemini-health";
import { spokenProductName } from "./product-title";
import { env } from "./env";
import { sanitizeShopperHtml, shopperFallbackHtml } from "./shopper-copy";

export function localCleanTitle(raw: string, currentTitle?: string) {
  return cleanTitle(raw, currentTitle, spokenProductName);
}

/** Neutral shopper body — never invents category claims from title keywords. */
export function localDescription(input: {
  title: string;
  rawTitle: string;
  cost: number;
  shipping: number;
  niche?: string;
  descriptionHint?: string;
}) {
  void input.rawTitle;
  void input.cost;
  void input.shipping;
  void input.niche;
  void input.descriptionHint;
  return shopperFallbackHtml(input.title);
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
    const result = await geminiGenerate({
      temperature: 0.55,
      system:
        "You write shopper-facing product copy only. Return JSON only: {title, descriptionHtml}. Title max 6 words, no wholesale brand codes, no year spam. Description is short HTML: one paragraph plus 3 benefit bullets grounded only in the product name — never invent category claims from loose title keywords (e.g. do not turn 'brush' into makeup copy or 'light' into night-light copy). Never mention cost, price, margin, ads, creative angles, or 'you pay about'. Never write medical or health claims (cure, treat, pain relief, alleviate, FDA). Never write for the seller.",
      user: `Raw title: ${input.rawTitle}\nShort name hint: ${fallbackTitle}\nNiche: ${input.niche ?? "general"}\nWrite descriptionHtml for a shopper using your returned title as the product name.`,
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
    let descriptionHtml = sanitizeShopperHtml(parsed.descriptionHtml || fallbackHtml, title);
    // Keep body in sync with the final title (model often rewrites title only).
    const oldHints = [input.currentTitle, input.rawTitle, fallbackTitle]
      .map((t) => t?.trim())
      .filter((t): t is string => Boolean(t && t !== title));
    for (const old of oldHints) {
      if (old.length >= 4 && descriptionHtml.includes(old)) {
        descriptionHtml = descriptionHtml.split(old).join(title);
      }
    }
    // If description still leads with a different product name, use neutral fallback (no keyword templates).
    if (!descriptionHtml.toLowerCase().includes(title.toLowerCase().slice(0, Math.min(12, title.length)))) {
      descriptionHtml = shopperFallbackHtml(title);
    }
    descriptionHtml = sanitizeShopperHtml(descriptionHtml, title);
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
