export const PROCESSING_EVENT = "seto-processing";

export function beginProcessing(text: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROCESSING_EVENT, { detail: { text } }));
}

export function endProcessing() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROCESSING_EVENT, { detail: { text: null } }));
}
