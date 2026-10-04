/** One tiny step at a time — the day’s plan for the coach chat. */

export type CoachStepId = "pick" | "import" | "clean" | "publish" | "angles" | "launch" | "done";

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

export const COACH_STEPS: Array<{ id: CoachStepId; title: string; href: string }> = [
  { id: "pick", title: "Find this product", href: "/discover" },
  { id: "import", title: "Import the listing you picked", href: "/discover" },
  { id: "clean", title: "Clean the shopper title", href: "/catalog" },
  { id: "publish", title: "Publish to your store", href: "/catalog" },
  { id: "angles", title: "Write ad angles + UTM", href: "/catalog" },
  { id: "launch", title: "Start one small paid test", href: "/ads" },
  { id: "done", title: "That’s the plan for today", href: "/" },
];

export function nextCoachStep(id: CoachStepId): CoachStepId {
  const i = COACH_STEPS.findIndex((s) => s.id === id);
  if (i < 0 || i >= COACH_STEPS.length - 1) return "done";
  return COACH_STEPS[i + 1]!.id;
}

export function coachStepMeta(id: CoachStepId) {
  return COACH_STEPS.find((s) => s.id === id) ?? COACH_STEPS[0]!;
}

export function openingMessages(keyword: string, why: string): CoachMessage[] {
  return [
    {
      id: "m1",
      role: "seto",
      text: "Here is today’s plan. We do one tiny step, then I wait until you finish it.",
    },
    {
      id: "m2",
      role: "seto",
      text: `Step 1 — Find this product: “${keyword}”. ${why}`.trim(),
    },
    {
      id: "m3",
      role: "seto",
      text: "Open Discover, search that phrase, pick ONE listing, then tap Share with Seto on the card. I’ll wait.",
    },
  ];
}

export function afterPickMessages(pick: CoachPick): CoachMessage[] {
  return [
    { id: "yp", role: "you", text: `I picked: ${pick.title}` },
    {
      id: "sp",
      role: "seto",
      text: "Got it. Next: import that listing into your catalog. Tap Import this listing here, or Import on Discover, then come back.",
    },
  ];
}

export function afterImportMessages(title: string): CoachMessage[] {
  return [
    {
      id: "si",
      role: "seto",
      text: `Imported “${title}” as a draft. Open it, make the title sound like something a shopper would tap, then tap I’m done in this chat.`,
    },
  ];
}

export function promptForStep(id: CoachStepId, pickTitle?: string): string {
  const name = pickTitle || "your product";
  switch (id) {
    case "clean":
      return `Open the draft for “${name}”. Fix wholesale wording. Tap I’m done when the title looks shopper-ready.`;
    case "publish":
      return `Publish “${name}” to your Seto store. Come back and tap I published it.`;
    case "angles":
      return `On the same listing, generate ad angles with a UTM link. Tap I’m done when you have at least one angle.`;
    case "launch":
      return `Open Ads & Guard. Launch one small test for “${name}”. Keep spend under your Guard floor. Tap I launched it when the ad is live.`;
    case "done":
      return "That’s enough for today. Fill any waiting orders, then leave ads alone.";
    default:
      return "Finish this step, then come back here.";
  }
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
