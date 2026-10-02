export type UtmSlice = {
  source?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
};

export type AttributionMatch = {
  model: "UTM_LAST_VISIT" | "UTM_FIRST_VISIT";
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  confidence: "EXACT_ID" | "ID_FROM_NAME_LOOKUP" | "PARTIAL" | "NONE";
};

function isMetaSource(source?: string | null) {
  return /^(facebook|fb|meta|ig|instagram)$/i.test((source ?? "").trim());
}

function numericId(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 5 ? digits : "";
}

export function matchAttribution(
  order: { last: UtmSlice; first: UtmSlice },
  exists: (id: string, level: "ADSET") => boolean,
  findByName: (term: string) => string | null,
): AttributionMatch[] {
  const out: AttributionMatch[] = [];
  for (const model of ["UTM_LAST_VISIT", "UTM_FIRST_VISIT"] as const) {
    const u = model === "UTM_LAST_VISIT" ? order.last : order.first;
    if (!isMetaSource(u.source)) continue;
    const adsetId = numericId(u.term);
    const adId = numericId(u.content) || null;
    const campId = numericId(u.campaign) || null;
    if (adsetId && exists(adsetId, "ADSET")) {
      out.push({ model, campaignId: campId, adsetId, adId, confidence: "EXACT_ID" });
    } else if (u.term && findByName(u.term)) {
      out.push({
        model,
        campaignId: campId,
        adsetId: findByName(u.term),
        adId,
        confidence: "ID_FROM_NAME_LOOKUP",
      });
    } else {
      out.push({ model, campaignId: campId, adsetId: adsetId || null, adId, confidence: "PARTIAL" });
    }
  }
  return out;
}
