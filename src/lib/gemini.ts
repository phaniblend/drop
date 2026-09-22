import "server-only";

import { env } from "./env";

type GeminiJson = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
};

/** Call Google Gemini and return the model text (JSON or plain). */
export async function geminiGenerate(input: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<string | null> {
  const key = env.geminiApiKey;
  if (!key) return null;

  const model = encodeURIComponent(env.geminiModel);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.user }] }],
      generationConfig: {
        temperature: input.temperature ?? 0.6,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as GeminiJson;
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text.trim() || null;
}

export function parseJsonObject<T>(content: string): T | null {
  try {
    const trimmed = content.replace(/```json|```/g, "").trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    const slice = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
    return JSON.parse(slice) as T;
  } catch {
    return null;
  }
}
