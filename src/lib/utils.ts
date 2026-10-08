import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayKey(timeZone = "America/Chicago", at: Date | string = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof at === "string" ? new Date(at) : at);
}

export function startOfTodayIso(timeZone = "America/Chicago") {
  return `${todayKey(timeZone)}T00:00:00.000`;
}

export function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

/** Store-timezone timestamps — always pass an explicit IANA zone so SSR and client match. */
export function shortDate(iso: string, timeZone = "America/Chicago") {
  const tz = timeZone.trim() || "America/Chicago";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function dayLabel(iso: string, timeZone = "America/Chicago") {
  const tz = timeZone.trim() || "America/Chicago";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/** Checked-at style stamp for Settings cards (hydration-safe when tz is fixed). */
export function checkedAtLabel(iso: string, timeZone = "America/Chicago") {
  return shortDate(iso, timeZone);
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
