export type ScrapedVariant = {
  skuId: string;
  name: string;
  image?: string;
  inventory: number;
  price?: number;
};

export type ScrapedListing = {
  title: string;
  price: { base: number; sale: number };
  images: string[];
  variants: ScrapedVariant[];
  supplierUrl: string;
};
