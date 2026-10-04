/** One tiny step. Seto instructs and pauses until the operator shares that it worked. */

export type CoachStepId = "pick" | "import" | "publish" | "ads" | "sale" | "kill" | "done";

export type CoachPick = {
  title: string;
  url: string;
  image?: string | null;
  cost?: number | null;
  source?: string | null;
};

export type CoachMessage = {
  id: string;
  role: "seto" | "you";
  text: string;
};

export type CoachFacts = {
  imported: boolean;
  published: boolean;
  adLinked: boolean;
  adPausedLoser: boolean;
  adWinning: boolean;
  hasCheckout: boolean;
  orderPlaced: boolean;
};

export const COACH_STEPS: Array<{
  id: CoachStepId;
  title: string;
  href: string;
  shareLabel: string;
}> = [
  { id: "pick", title: "Find the product", href: "/discover", shareLabel: "Share with Seto" },
  { id: "import", title: "Import to catalog", href: "/discover", shareLabel: "I imported it" },
  { id: "publish", title: "Publish to the store", href: "/catalog", shareLabel: "I published it" },
  { id: "ads", title: "Post the ad", href: "/ads", shareLabel: "The ad is live" },
  { id: "sale", title: "Handle the sale", href: "/fulfillment", shareLabel: "I placed the supplier order" },
  { id: "kill", title: "Kill a losing ad", href: "/ads", shareLabel: "The loser is paused" },
  { id: "done", title: "Pipeline complete", href: "/", shareLabel: "Done" },
];

export function normalizeCoachStep(id: string): CoachStepId {
  if (id === "clean") return "import";
  if (id === "angles" || id === "launch") return "ads";
  if (COACH_STEPS.some((s) => s.id === id)) return id as CoachStepId;
  return "pick";
}

export function nextCoachStep(id: CoachStepId): CoachStepId {
  const i = COACH_STEPS.findIndex((s) => s.id === id);
  if (i < 0 || i >= COACH_STEPS.length - 1) return "done";
  return COACH_STEPS[i + 1]!.id;
}

export function coachStepMeta(id: CoachStepId) {
  return COACH_STEPS.find((s) => s.id === id) ?? COACH_STEPS[0]!;
}

export function instructionFor(step: CoachStepId, ctx: { keyword?: string; why?: string; title?: string }): string {
  const name = ctx.title || "this product";
  switch (step) {
    case "pick":
      return `Find this product: “${ctx.keyword}”. ${ctx.why ?? ""} Search Discover, pick ONE listing, tap Share with Seto. I’ll wait.`.replace(/\s+/g, " ").trim();
    case "import":
      return `Import “${name}”. Tap Import on the Discover card (or Import in the preview). Clean the shopper title if it still looks wholesale. Then tap I imported it. I’ll wait.`;
    case "publish":
      return `Publish “${name}” to your live store (Shopify if you connected it, otherwise your Seto store). Then tap I published it. I’ll wait.`;
    case "ads":
      return `On the listing, generate ad angles with a UTM link. Then launch one small test in Ads & Guard. Keep spend under your Guard floor. Tap The ad is live. I’ll wait.`;
    case "sale":
      return `When a checkout lands, open Fulfill, buy it from the supplier, and mark placed. Tap I placed the supplier order. I’ll wait — even if the sale is not here yet.`;
    case "kill":
      return `If an ad hit the spend floor with no profit, pause it (or confirm Guard already did). Do not kill a winner. Tap The loser is paused when a loser is off. I’ll wait.`;
    default:
      return "Pipeline complete. Fill leftover orders, leave winning ads on, keep Guard armed.";
  }
}

export function youSaid(step: CoachStepId, pickTitle?: string, facts?: CoachFacts): string {
  const name = pickTitle || "the listing";
  switch (step) {
    case "pick":
      return `Shared listing: ${name}`;
    case "import":
      return "Imported it into the catalog.";
    case "publish":
      return "Published it to the store.";
    case "ads":
      return "Ad test is live.";
    case "sale":
      return "Supplier order is placed.";
    case "kill":
      return facts?.adWinning && !facts.adPausedLoser
        ? "Checked ads. Winner stays on. Guard stays armed."
        : "Losing ad is paused.";
    default:
      return "Done.";
  }
}

export function evaluateShare(step: CoachStepId, facts: CoachFacts): { ok: true } | { ok: false; wait: string } {
  switch (step) {
    case "pick":
      return { ok: true };
    case "import":
      return facts.imported
        ? { ok: true }
        : { ok: false, wait: "I don’t see that listing in Catalog yet. Import it on Discover, then share again. I’ll wait." };
    case "publish":
      return facts.published
        ? { ok: true }
        : { ok: false, wait: "I don’t see it live on the store yet. Click Publish, then share again. I’ll wait." };
    case "ads":
      return facts.adLinked
        ? { ok: true }
        : { ok: false, wait: "I don’t see an ad set linked to this product. Launch it in Ads & Guard, then share again. I’ll wait." };
    case "sale":
      if (!facts.hasCheckout) {
        return { ok: false, wait: "No checkout yet. I’ll wait. When one lands, place the supplier order, then share again." };
      }
      return facts.orderPlaced
        ? { ok: true }
        : { ok: false, wait: "Checkout is in Fulfill but not marked placed. Buy it from the supplier, mark placed, then share again. I’ll wait." };
    case "kill":
      if (facts.adPausedLoser) return { ok: true };
      if (facts.adWinning) {
        return { ok: true };
      }
      return {
        ok: false,
        wait: "No loser is paused yet, and this test is not a clear winner. Pause the burning ad in Ads & Guard, then share again. I’ll wait.",
      };
    default:
      return { ok: true };
  }
}

export function openingMessages(keyword: string, why: string): CoachMessage[] {
  return [
    {
      id: "m1",
      role: "seto",
      text: "Today we walk the full pipeline, one step at a time: find → import → publish → ads → sale → kill losers. I instruct, then I pause until you share that it worked.",
    },
    {
      id: "m2",
      role: "seto",
      text: instructionFor("pick", { keyword, why }),
    },
  ];
}

export const KEYWORD_FALLBACKS = [
  { keyword: "posture corrector brace", why: "Simple wearable, easy photo ads, repeat search demand." },
  { keyword: "car trash can hanging", why: "Cheap impulse add-on with clear before/after in a car." },
  { keyword: "pet hair remover roller", why: "Home + pet search volume without a licensed brand." },
  { keyword: "ultrasonic plaque remover", why: "High intent search; check claims stay off the listing." },
  { keyword: "makeup brush set travel", why: "Beauty kit with a clean photo and easy 3× markup." },
] as const;

export function fallbackKeywordForDay(dateLocal: string) {
  const n = dateLocal.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return KEYWORD_FALLBACKS[n % KEYWORD_FALLBACKS.length]!;
}
