import "server-only";

import { eq } from "drizzle-orm";
import { env } from "./env";
import { ensureDb } from "./db";
import { settings } from "./db/schema";
import { geminiGenerate } from "./gemini";

const SETTINGS_KEY = "gemini_health";
const STALE_MS = 60 * 60 * 1000;

export type GeminiHealth = {
  configured: boolean;
  live: boolean;
  error: string | null;
  model: string;
  checkedAt: string | null;
};

type Stored = {
  live: boolean;
  error: string | null;
  model: string;
  checkedAt: string;
};

function emptyHealth(configured: boolean): GeminiHealth {
  return {
    configured,
    live: false,
    error: configured ? "Not checked yet" : "GEMINI_API_KEY is not set",
    model: env.geminiModel,
    checkedAt: null,
  };
}

async function readStored(): Promise<Stored | null> {
  try {
    const db = await ensureDb();
    const [row] = await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1);
    if (!row?.value) return null;
    return JSON.parse(row.value) as Stored;
  } catch {
    return null;
  }
}

async function writeStored(value: Stored) {
  const db = await ensureDb();
  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: JSON.stringify(value) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: JSON.stringify(value) },
    });
}

/** Lightweight live ping; cached ~1h unless force. */
export async function pingGemini(force = false): Promise<GeminiHealth> {
  const configured = Boolean(env.geminiApiKey);
  if (!configured) return emptyHealth(false);

  const cached = await readStored();
  if (
    !force &&
    cached?.checkedAt &&
    Date.now() - Date.parse(cached.checkedAt) < STALE_MS
  ) {
    return {
      configured: true,
      live: cached.live,
      error: cached.error,
      model: cached.model,
      checkedAt: cached.checkedAt,
    };
  }

  const result = await geminiGenerate({
    temperature: 0,
    system: 'Reply with JSON only: {"ok":true}',
    user: "health check",
  });

  const stored: Stored = {
    live: Boolean(result.text),
    error: result.error,
    model: result.model,
    checkedAt: new Date().toISOString(),
  };
  try {
    await writeStored(stored);
  } catch (e) {
    console.error("[gemini-health] could not persist", e);
  }

  return {
    configured: true,
    live: stored.live,
    error: stored.error,
    model: stored.model,
    checkedAt: stored.checkedAt,
  };
}

export async function getGeminiHealth(force = false): Promise<GeminiHealth> {
  return pingGemini(force);
}

/** Record outcome of a real generate call so Settings stays honest. */
export async function recordGeminiCall(result: { text: string | null; error: string | null; model: string }) {
  if (!env.geminiApiKey) return;
  const stored: Stored = {
    live: Boolean(result.text),
    error: result.error,
    model: result.model,
    checkedAt: new Date().toISOString(),
  };
  try {
    await writeStored(stored);
  } catch {
    /* ignore */
  }
}
