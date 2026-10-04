const OPERATOR_LINE =
  /you pay about|room for ads|creative angle|doesn['’]t land|impulse-friendly|positioned for shoppers|supplier cost|markup|cogs|wholesale/i;

/** Meta/TikTok-sensitive medical phrasing — strip from shopper HTML. */
const HEALTH_CLAIM =
  /\b(alleviate|discomfort|spinal\s+alignment|pain\s+relief|cure[sd]?|treats?|fda\s+approved|prescription|medical\s+device|clinically\s+proven|heal(?:s|ing)?)\b/i;

const SHIP_FROM =
  /^(united states|china(\s+mainland)?|mainland china|ships?\s*from.*|ship to|warehouse|us|cn|uk|spain|france|russia|brazil|korea|japan)$/i;

function isShipFromPart(part: string) {
  const text = part.trim();
  if (!text) return true;
  if (SHIP_FROM.test(text)) return true;
  return /china|mainland|warehouse|ships?\s*from|ship\s*from/i.test(text) && text.split(/\s+/).length <= 4;
}

export function isOperatorShopperLine(text: string) {
  return OPERATOR_LINE.test(text);
}

export function isHealthClaimLine(text: string) {
  return HEALTH_CLAIM.test(text);
}

export function sanitizeShopperHtml(html: string, title: string) {
  const source = html?.trim() || "";
  if (!source) return shopperFallbackHtml(title);

  const withoutBadItems = source
    .replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, (item) => {
      const text = item.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return isOperatorShopperLine(text) || isHealthClaimLine(text) || /you pay about\s*\$/i.test(text)
        ? ""
        : item;
    })
    .replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (block) => {
      const text = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return isOperatorShopperLine(text) || isHealthClaimLine(text) ? "" : block;
    });

  const text = withoutBadItems.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const titleHint = title.trim().slice(0, Math.min(12, title.trim().length)).toLowerCase();
  if (
    !text ||
    isOperatorShopperLine(text) ||
    isHealthClaimLine(text) ||
    /you pay about\s*\$/i.test(text) ||
    (titleHint.length >= 4 && !text.toLowerCase().includes(titleHint))
  ) {
    return shopperFallbackHtml(title, source);
  }
  return withoutBadItems;
}

export function shopperFallbackHtml(title: string, hint?: string) {
  const name = title.trim() || "This product";
  const blob = `${name} ${hint ?? ""}`.toLowerCase();
  const bullets: string[] = [];
  if (/brush|makeup|cosmetic/i.test(blob)) {
    bullets.push("Soft bristles for everyday makeup");
    bullets.push("Easy to clean after use");
  } else if (/fan|cooler|blender|juicer/i.test(blob)) {
    bullets.push("USB rechargeable for home or travel");
    bullets.push("Compact size that packs light");
  } else if (/light|lamp|led|sign/i.test(blob)) {
    bullets.push("Bright enough to see at night");
    bullets.push("Simple to place where you need it");
  } else if (/posture|belt|brace|support/i.test(blob)) {
    bullets.push("Adjustable straps for a snug fit");
    bullets.push("Breathable fabric for daily wear");
  } else {
    bullets.push("Looks like the photos");
    bullets.push("Ready for everyday use");
  }
  bullets.push("Tracked shipping · refund or replacement if it arrives wrong or damaged");
  return `<p>${name} is made for daily use — ${bullets[0]!.charAt(0).toLowerCase()}${bullets[0]!.slice(1)}.</p><ul>${bullets
    .slice(0, 3)
    .map((b) => `<li>${b}</li>`)
    .join("")}</ul>`;
}

function looksLikeSupplierSku(part: string) {
  return /^\d{6,}[:#]/.test(part) || /:\d{6,}/.test(part) || /#\w+\s*T\d+/i.test(part);
}

export function shopperVariantLabel(raw: string) {
  const parts = String(raw ?? "")
    .split(/\s*·\s*|\s*;\s*/)
    .map((part) => part.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(
      (part) =>
        part &&
        !isShipFromPart(part) &&
        !/^option$/i.test(part) &&
        !looksLikeSupplierSku(part),
    );
  return parts.length ? [...new Set(parts)].join(" · ") : "Option";
}

export type PublicStoreVariant = {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
};

export type PublicStoreProduct = {
  id: string;
  userId?: string;
  title: string;
  descriptionHtml: string;
  imageUrl: string | null;
  gallery: string[];
  shippingDays: number;
  price: number;
  variants: PublicStoreVariant[];
};

function parseGalleryJson(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((u) => String(u ?? "").trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export function toPublicProduct(input: {
  id: string;
  userId?: string;
  cleanTitle?: string | null;
  rawTitle: string;
  descriptionHtml?: string | null;
  imageUrl?: string | null;
  galleryJson?: string | null;
  gallery?: string[] | null;
  shippingDays: number;
  retailPrice: number;
  variants: Array<{
    id: string;
    variantName: string;
    variantPrice: number;
    inventoryCount: number;
    supplierImageUrl?: string | null;
    cleanImageUrl?: string | null;
  }>;
}): PublicStoreProduct {
  const title = input.cleanTitle || input.rawTitle;
  const variants = (input.variants.length
    ? input.variants
    : [{ id: "default", variantName: "Default", variantPrice: input.retailPrice, inventoryCount: 0 }]
  ).map((variant) => ({
    id: variant.id,
    name: shopperVariantLabel(variant.variantName),
    price: variant.variantPrice || input.retailPrice,
    stock: Math.max(0, variant.inventoryCount),
    imageUrl: variant.cleanImageUrl || variant.supplierImageUrl || null,
  }));
  const fromField = (input.gallery ?? []).map((u) => String(u ?? "").trim()).filter(Boolean);
  const gallery = [...new Set([...fromField, ...parseGalleryJson(input.galleryJson)])];
  return {
    id: input.id,
    userId: input.userId,
    title,
    descriptionHtml: sanitizeShopperHtml(input.descriptionHtml ?? "", title),
    imageUrl: input.imageUrl ?? null,
    gallery,
    shippingDays: input.shippingDays,
    price: variants[0]?.price || input.retailPrice,
    variants,
  };
}

export function publicHtmlLeaksOperatorCopy(html: string, cost?: number) {
  const text = html.replace(/<[^>]+>/g, " ");
  if (isOperatorShopperLine(text) || /you pay about\s*\$/i.test(text)) return true;
  if (cost && cost > 0 && text.includes(cost.toFixed(2))) return true;
  return false;
}
