export type VariantNameLookup = Map<string, string>;

function cleanName(value: unknown) {
  const text = String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length > 64 || !/[A-Za-z]/.test(text)) return "";
  if (/^\d+$/.test(text)) return "";
  return text;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function remember(map: VariantNameLookup, key: unknown, name: string) {
  if (key == null || key === "") return;
  const id = String(key).trim();
  if (!id || map.has(id)) return;
  map.set(id, name);
}

export function collectVariantLookup(source: unknown, map: VariantNameLookup = new Map()): VariantNameLookup {
  walkLookup(source, map, 0);
  return map;
}

function walkLookup(value: unknown, map: VariantNameLookup, depth: number) {
  if (!value || depth > 8) return;
  if (Array.isArray(value)) {
    for (const item of value) walkLookup(item, map, depth + 1);
    return;
  }
  const rec = asRecord(value);
  if (!rec) return;

  const name = cleanName(
    rec.propertyValueDisplayName ??
      rec.propertyValueName ??
      rec.propertyValueDefinitionName ??
      rec.property_value_definition_name ??
      rec.skuPropertyTips ??
      rec.sku_property_value ??
      rec.skuPropertyValue,
  );
  if (name) {
    const propId = rec.skuPropertyId ?? rec.sku_property_id ?? rec.skuPropertyIdLong;
    const valueIds = [
      rec.propertyValueId,
      rec.property_value_id,
      rec.skuPropertyValueId,
      rec.propertyValueIdLong,
      rec.sku_property_value_id,
    ];
    for (const id of valueIds) {
      remember(map, id, name);
      if (propId != null) remember(map, `${propId}:${id}`, name);
    }
  }

  for (const child of Object.values(rec)) {
    if (child && typeof child === "object") walkLookup(child, map, depth + 1);
  }
}

function labelFromSegment(segment: string, lookup?: VariantNameLookup) {
  const trimmed = segment.trim();
  if (!trimmed) return "";

  const hash = trimmed.indexOf("#");
  if (hash >= 0) {
    const named = cleanName(trimmed.slice(hash + 1));
    if (named) return named;
  }

  const pair = trimmed.match(/^(\d+):(\d+)$/);
  if (pair) {
    return lookup?.get(`${pair[1]}:${pair[2]}`) || lookup?.get(pair[2]) || "";
  }

  const named = trimmed.match(/^([A-Za-z][\w\s/-]*):\s*(.+)$/);
  if (named) {
    const value = cleanName(named[2]);
    return value ? `${named[1].trim()}: ${value}` : "";
  }

  if (/^[A-Za-z]/.test(trimmed) && !/^\d+:/.test(trimmed)) return cleanName(trimmed);

  const last = trimmed.split(":").pop()?.trim() ?? "";
  return cleanName(last);
}

export function humanizeVariantLabel(raw: string, lookup?: VariantNameLookup) {
  const value = raw?.trim() || "";
  if (!value || value === "Default") return "Default";
  // Already humanized names from a prior import — keep them.
  if (!/\d+:\d+/.test(value) && /[A-Za-z]/.test(value) && value.length <= 64) {
    if (!value.includes(";") || value.includes(" · ")) return value;
  }
  const parts = value
    .split(";")
    .map((segment) => labelFromSegment(segment, lookup))
    .filter(Boolean);
  return parts.length ? [...new Set(parts)].join(" · ") : "Option";
}

function skuHint(sku: string | undefined, index: number) {
  const raw = String(sku ?? "").trim();
  if (!raw || raw === "DEFAULT" || raw === "default") return "";
  const tail = raw.slice(-6);
  if (/^[A-Za-z0-9_-]+$/.test(tail) && tail.length >= 3) return `SKU …${tail}`;
  return `Option ${index + 1}`;
}

/** Best display name: lookup → humanize → cost/SKU differentiator (never bare "Option"). */
export function labeledVariantName(
  raw: string,
  index: number,
  lookup?: VariantNameLookup,
  extras?: { sku?: string; cost?: number },
) {
  const label = humanizeVariantLabel(raw, lookup);
  if (label !== "Option") return label;

  const hint = skuHint(extras?.sku, index);
  if (extras?.cost && extras.cost > 0) {
    return hint ? `${hint} · $${extras.cost.toFixed(2)}` : `$${extras.cost.toFixed(2)} option`;
  }
  return hint || `Variant ${index + 1}`;
}
