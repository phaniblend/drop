import "server-only";

import { geminiGenerate, parseJsonObject } from "./gemini";
import { recordGeminiCall } from "./gemini-health";
import { env } from "./env";
import { fallbackKeywordForDay } from "./coach-plan";

export async function suggestWinningKeyword(dateLocal: string) {
  const fallback = fallbackKeywordForDay(dateLocal);
  if (!env.geminiApiKey) return { ...fallback, source: "local" as const };

  const result = await geminiGenerate({
    temperature: 0.4,
    system:
      "You pick ONE AliExpress search keyword for a US dropshipper today. Return JSON only: {keyword, why}. Keyword is 2–5 words, no brand names, no medical cure claims, no weapons. Why is one short sentence.",
    user: `Date ${dateLocal}. Prefer impulse home, car, pet, beauty, or outdoor gadgets that can sell at 3× landed cost.`,
  });
  await recordGeminiCall(result);
  const parsed = result.text
    ? parseJsonObject<{ keyword?: string; why?: string }>(result.text)
    : null;
  const keyword = parsed?.keyword?.trim().replace(/^["']|["']$/g, "");
  if (!keyword || keyword.length < 4 || keyword.length > 48) {
    return { ...fallback, source: "local" as const };
  }
  return {
    keyword,
    why: (parsed?.why || fallback.why).trim().slice(0, 160),
    source: "gemini" as const,
  };
}
