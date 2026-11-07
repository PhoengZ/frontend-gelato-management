import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Allergen } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats an amount in baht. */
export function formatPrice(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

/** Formats an integer amount in satang (the backend's `*_minor` fields). */
export function formatMinor(amountMinor: number) {
  return formatPrice(amountMinor / 100);
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

const SLOT_MINUTES = 15;
const SLOT_COUNT = 8;

const bangkokDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });

export function isSameBangkokDay(a: Date, b: Date) {
  return bangkokDay.format(a) === bangkokDay.format(b);
}

/**
 * Pickup times on 15-minute boundaries, starting at least one slot from now. Order only accepts
 * a pickup on the current calendar day in Asia/Bangkok, so the list can be short or empty.
 */
export function pickupSlots(now = new Date()) {
  const first = new Date(now);
  first.setSeconds(0, 0);
  first.setMinutes(Math.ceil(first.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES + SLOT_MINUTES);
  return Array.from({ length: SLOT_COUNT }, (_, index) => new Date(first.getTime() + index * SLOT_MINUTES * 60_000))
    .filter((slot) => isSameBangkokDay(slot, now))
    .map((slot) => slot.toISOString());
}

/** `YYYY-MM-DD` for a date input, in the browser's calendar day rather than UTC's. */
export function dateInputValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export const allergenLabels: Record<Allergen, string> = {
  MILK: "นม",
  EGG: "ไข่",
  PEANUT: "ถั่วลิสง",
  TREE_NUT: "ถั่วเปลือกแข็ง",
  SOY: "ถั่วเหลือง",
  GLUTEN: "กลูเตน"
};

/** Soft background behind a flavor photo, picked from its name (Figma: pistachio/pink/vanilla-soft). */
export function flavorTint(name: string) {
  const lower = name.toLowerCase();
  if (/(pistachio|matcha|mint|green)/.test(lower)) return "bg-pistachio-soft";
  if (/(vanilla|mango|lemon|banana|coconut|thai)/.test(lower)) return "bg-vanilla-soft";
  return "bg-pink-soft";
}
