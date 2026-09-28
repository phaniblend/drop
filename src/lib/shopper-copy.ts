const OPERATOR_LINE =
  /you pay about|room for ads|creative angle|doesn['’]t land|impulse-friendly|positioned for shoppers|supplier cost|markup|cogs|wholesale/i;

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

export function sanitizeShopperHtml(html: string, title: string) {
  const source = html?.trim() || "";
  if (!source) return shopperFallbackHtml(title);

  const withoutBadItems = source
    .replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, (item) => {
      const text = item.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return isOperatorShopperLine(text) || /you pay about\s*\$/i.test(text) ? "" : item;
    })
    .replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (block) => {
      const text = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return isOperatorShopperLine(text) ? "" : block;
    });

  const text = withoutBadItems.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const titleHint = title.trim().slice(0, Math.min(12, title.trim().length)).toLowerCase();
  if (
    !text ||
    isOperatorShopperLine(text) ||
    /you pay about\s*\$/i.test(text) ||
    (titleHint.length >= 4 && !text.toLowerCase().includes(titleHint))
  ) {
    return shopperFallbackHtml(title);
  }
  return withoutBadItems;
}

export function shopperFallbackHtml(title: string) {
  const name = title.trim() || "This product";
  return `<p>${name} ships with tracking. What you see is what we send.</p><ul><li>Tracked shipping</li><li>Packed as shown</li><li>Refund or replacement if it arrives wrong or damaged</li></ul>`;
}

export function shopperVariantLabel(raw: string) {
  const parts = String(raw ?? "")
    .split(/\s*·\s*|\s*;\s*/)
    .map((part) => part.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim())
    .filter((part) => part && !isShipFromPart(part) && !/^option$/i.test(part));
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
  shippingDays: number;
  price: number;
  variants: PublicStoreVariant[];
};

export function toPublicProduct(input: {
  id: string;
  userId?: string;
  cleanTitle?: string | null;
  rawTitle: string;
  descriptionHtml?: string | null;
  imageUrl?: string | null;
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
  return {
    id: input.id,
    userId: input.userId,
    title,
    descriptionHtml: sanitizeShopperHtml(input.descriptionHtml ?? "", title),
    imageUrl: input.imageUrl ?? null,
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
