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

/** Pickup times on 15-minute boundaries, starting at least one slot from now. */
export function pickupSlots(now = new Date()) {
  const first = new Date(now);
  first.setSeconds(0, 0);
  first.setMinutes(Math.ceil(first.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES + SLOT_MINUTES);
  return Array.from({ length: SLOT_COUNT }, (_, index) => new Date(first.getTime() + index * SLOT_MINUTES * 60_000).toISOString());
}

export const allergenLabels: Record<Allergen, string> = {
  MILK: "Milk",
  EGG: "Egg",
  PEANUT: "Peanut",
  TREE_NUT: "Tree nut",
  SOY: "Soy",
  GLUTEN: "Gluten"
};
