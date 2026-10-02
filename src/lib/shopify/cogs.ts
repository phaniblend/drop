export type CostSource = "MANUAL" | "CSV_IMPORT" | "SUPPLIER_SYNC" | "SHOPIFY_UNIT_COST";

const PRECEDENCE: Record<CostSource, number> = {
  MANUAL: 4,
  CSV_IMPORT: 3,
  SUPPLIER_SYNC: 2,
  SHOPIFY_UNIT_COST: 1,
};

export type VariantCostRow = {
  unitCogs: number;
  unitShippingCost: number;
  source: CostSource;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

export type FinanceConfig = {
  defaultShippingCost: number;
  defaultCogsPctOfPrice?: number | null;
};

export function resolveUnitCost(
  rows: VariantCostRow[],
  atUtc: string,
  unitPrice: number,
  config: FinanceConfig,
) {
  const at = Date.parse(atUtc);
  const open = rows.filter((row) => {
    const from = Date.parse(row.effectiveFrom);
    const to = row.effectiveTo ? Date.parse(row.effectiveTo) : Number.POSITIVE_INFINITY;
    return from <= at && at < to;
  });
  open.sort((a, b) => {
    const prec = PRECEDENCE[b.source] - PRECEDENCE[a.source];
    if (prec) return prec;
    return Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom);
  });
  const row = open[0];
  if (row) return { cogs: row.unitCogs, ship: row.unitShippingCost, source: row.source, estimated: false };
  if (config.defaultCogsPctOfPrice != null) {
    return {
      cogs: round2(unitPrice * config.defaultCogsPctOfPrice),
      ship: config.defaultShippingCost,
      source: null as CostSource | null,
      estimated: true,
    };
  }
  return null;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}
