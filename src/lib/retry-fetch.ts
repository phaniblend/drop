function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBusy(status: number) {
  return status === 502 || status === 503 || status === 504;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let last: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (isBusy(res.status)) {
        last = new Error("The desk is busy. Try again.");
        await wait(400 * (attempt + 1));
        continue;
      }
      const data = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) throw new Error(data.error || "Request failed. Try again.");
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      last = error instanceof Error ? error : new Error("Request failed. Try again.");
      if (attempt < 2) await wait(400 * (attempt + 1));
    }
  }
  throw last ?? new Error("Request failed. Try again.");
}
