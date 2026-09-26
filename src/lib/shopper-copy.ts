const OPERATOR_LINE =
  /you pay about|room for ads|creative angle|doesn['’]t land|impulse-friendly|positioned for shoppers|supplier cost|markup|cogs|wholesale/i;

const SHIP_FROM = /^(united states|ship\s*from|ships from|ship to|us)$/i;

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
  return `<p>${name} is designed for daily use — simple setup, a clean look, and tracked shipping.</p><ul><li>Easy to install</li><li>Tracked shipping</li><li>Simple returns if you need them</li></ul>`;
}

export function shopperVariantLabel(raw: string) {
  const parts = String(raw ?? "")
    .split(/\s*·\s*|\s*;\s*/)
    .map((part) => part.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim())
    .filter((part) => part && !SHIP_FROM.test(part) && !/^option$/i.test(part));
  return parts.length ? [...new Set(parts)].join(" · ") : "Option";
}

export type PublicStoreVariant = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export type PublicStoreProduct = {
  id: string;
  title: string;
  descriptionHtml: string;
  imageUrl: string | null;
  shippingDays: number;
  price: number;
  variants: PublicStoreVariant[];
};

export function toPublicProduct(input: {
  id: string;
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
  }));
  return {
    id: input.id,
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
