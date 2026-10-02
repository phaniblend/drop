export type UtmIssue = {
  code: string;
  severity: "E" | "W";
  detail?: string;
};

export type UtmCheckStatus = "OK" | "WARN" | "ERROR" | "UNREADABLE";

function parseQuery(raw: string) {
  const out: Record<string, string> = {};
  const q = raw.replace(/^\?/, "");
  if (!q) return out;
  for (const part of q.split("&")) {
    if (!part) continue;
    const [k, ...rest] = part.split("=");
    if (!k) continue;
    out[decodeURIComponent(k)] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function isMetaSource(source: string) {
  return /^(facebook|fb|meta|ig|instagram)$/i.test(source.trim());
}

function isShopDomain(link: string, shop: { primaryDomain?: string | null; shopDomain: string }) {
  try {
    const host = new URL(link).hostname.toLowerCase();
    const primary = (shop.primaryDomain || "").toLowerCase().replace(/^www\./, "");
    const myshop = shop.shopDomain.toLowerCase().replace(/^https?:\/\//, "");
    return (
      (primary && (host === primary || host.endsWith(`.${primary}`))) ||
      host === myshop ||
      host.endsWith(".myshopify.com")
    );
  } catch {
    return false;
  }
}

export function checkAdUtm(input: {
  landingUrl?: string | null;
  urlTags?: string | null;
  adsetId: string;
  shop: { primaryDomain?: string | null; shopDomain: string };
}): { status: UtmCheckStatus; issues: UtmIssue[] } {
  const issues: UtmIssue[] = [];
  const link = input.landingUrl ?? "";
  let inUrl: Record<string, string> = {};
  try {
    inUrl = link ? parseQuery(new URL(link).search) : {};
  } catch {
    return { status: "UNREADABLE", issues: [{ code: "UNREADABLE_CREATIVE", severity: "E" }] };
  }
  const tags = parseQuery(input.urlTags ?? "");
  const all = { ...inUrl, ...tags };

  if (!link) issues.push({ code: "NO_LANDING_URL", severity: "E" });
  else if (!isShopDomain(link, input.shop)) {
    issues.push({ code: "LANDING_NOT_SHOP_DOMAIN", severity: "E", detail: link });
  } else if (!/\/products\//.test(link)) {
    issues.push({ code: "LANDING_NOT_PRODUCT_PAGE", severity: "W" });
  }

  if (!all.utm_source) issues.push({ code: "MISSING_UTM_SOURCE", severity: "E" });
  else if (!isMetaSource(all.utm_source)) {
    issues.push({ code: "UTM_SOURCE_NOT_META", severity: "E", detail: all.utm_source });
  }

  const term = all.utm_term;
  if (!term) issues.push({ code: "MISSING_ADSET_ID", severity: "E" });
  else if (term === "{{adset.id}}") {
    /* ok */
  } else if (term === "{{adset.name}}") {
    issues.push({ code: "ADSET_NAME_MACRO", severity: "W" });
  } else if (/^\d+$/.test(term) && term !== input.adsetId) {
    issues.push({ code: "HARDCODED_WRONG_ADSET_ID", severity: "E", detail: term });
  } else if (/^\d+$/.test(term)) {
    issues.push({ code: "HARDCODED_ADSET_ID", severity: "W" });
  } else {
    issues.push({ code: "UNRECOGNIZED_ADSET_VALUE", severity: "E", detail: term });
  }

  if (all.utm_campaign !== "{{campaign.id}}") {
    issues.push({ code: "CAMPAIGN_ID_MACRO_MISSING", severity: "W" });
  }
  if (all.utm_content !== "{{ad.id}}") {
    issues.push({ code: "AD_ID_MACRO_MISSING", severity: "W" });
  }
  if (inUrl.utm_source && tags.utm_source) {
    issues.push({ code: "DUPLICATE_PARAMS_URL_AND_TAGS", severity: "W" });
  }
  if (/\{[^{][^}]*\}(?!\})/.test(input.urlTags ?? "")) {
    issues.push({ code: "SINGLE_BRACE_MACRO", severity: "E" });
  }

  if (issues.some((i) => i.severity === "E")) return { status: "ERROR", issues };
  if (issues.length) return { status: "WARN", issues };
  return { status: "OK", issues };
}

export const REQUIRED_UTM_PARAMS =
  "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}";
