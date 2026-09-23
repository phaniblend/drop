import "server-only";

import { env } from "./env";

type GeminiJson = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; status?: string; code?: number };
};

export type GeminiGenerateResult = {
  text: string | null;
  error: string | null;
  model: string;
};

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-latest",
];

function modelsToTry() {
  const preferred = env.geminiModel || "gemini-2.5-flash";
  // Skip known-dead 2.0 IDs even if GEMINI_MODEL still points at them.
  const dead = /^gemini-2\.0-flash/i.test(preferred);
  const start = dead ? "gemini-2.5-flash" : preferred;
  return [start, ...FALLBACK_MODELS.filter((m) => m !== start)];
}

async function callModel(
  model: string,
  key: string,
  input: { system: string; user: string; temperature?: number },
  asJson: boolean,
): Promise<GeminiGenerateResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [{ role: "user", parts: [{ text: input.user }] }],
    generationConfig: {
      temperature: input.temperature ?? 0.6,
      ...(asJson ? { responseMimeType: "application/json" } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    console.error("[gemini] fetch failed", { model, msg });
    return { text: null, error: `Gemini network: ${msg}`, model };
  }

  const raw = await res.text();
  let json: GeminiJson;
  try {
    json = JSON.parse(raw) as GeminiJson;
  } catch {
    const msg = `Gemini ${res.status}: non-JSON body`;
    console.error("[gemini]", msg, raw.slice(0, 240));
    return { text: null, error: msg, model };
  }

  if (!res.ok || json.error) {
    const msg =
      json.error?.message ||
      `Gemini HTTP ${res.status}${json.error?.status ? ` (${json.error.status})` : ""}`;
    console.error("[gemini] API error", { model, msg });
    return { text: null, error: msg, model };
  }

  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    const reason = json.candidates?.[0]?.finishReason || "empty candidates";
    const msg = `Gemini returned no text (${reason})`;
    console.error("[gemini]", msg, { model });
    return { text: null, error: msg, model };
  }
  return { text: text.trim(), error: null, model };
}

/** Call Google Gemini and return text plus a visible error reason on failure. */
export async function geminiGenerate(input: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<GeminiGenerateResult> {
  const key = env.geminiApiKey;
  if (!key) {
    return { text: null, error: "GEMINI_API_KEY is not set", model: env.geminiModel };
  }

  let last: GeminiGenerateResult = {
    text: null,
    error: "No model attempted",
    model: env.geminiModel,
  };

  for (const model of modelsToTry()) {
    last = await callModel(model, key, input, true);
    if (last.text) return last;
    // Retry same model without forced JSON mime if that was the failure mode.
    if (last.error && /mime|json|response/i.test(last.error)) {
      last = await callModel(model, key, input, false);
      if (last.text) return last;
    }
    // Try next model on 404 / not found / unsupported.
    if (last.error && /not found|404|NOT_FOUND|unsupported/i.test(last.error)) continue;
    // Other errors (auth, quota) — don't thrash models.
    if (last.error && /API key|permission|403|401|quota|RESOURCE/i.test(last.error)) return last;
  }

  return last;
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

export { formatGeminiFallback } from "./copy-local";
