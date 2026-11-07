import type { AppNotification } from "@/types";

/** Pickup times are the shop's local time, whatever timezone the customer's device uses. */
const shopTime = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const shopDateTime = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

const cancellationText: Record<string, string> = {
  PAYMENT_FAILED: "คำสั่งซื้อถูกยกเลิก เพราะชำระเงินไม่สำเร็จ",
  CUSTOMER_REQUEST: "ยกเลิกคำสั่งซื้อตามที่คุณขอแล้ว",
  RESERVATION_EXPIRED: "คำสั่งซื้อถูกยกเลิก เพราะชำระเงินไม่ทันเวลาที่จองไว้ ระบบคืนสต็อกแล้ว",
  // The demo has no automatic refund for a store cancellation; the store arranges it by hand.
  STORE_CANCELLED: "ร้านยกเลิกคำสั่งซื้อนี้แล้ว ทางร้านจะติดต่อเพื่อคืนเงินให้คุณ"
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** "Pistachio (Batch GF-01)", "Pistachio", "Batch GF-01", or undefined when the event names neither. */
function batchLabel(data: AppNotification["data"]) {
  const flavor = text(data.flavor_name);
  const code = text(data.batch_code);
  if (flavor && code) return `${flavor} (Batch ${code})`;
  return flavor ?? (code ? `Batch ${code}` : undefined);
}

function confirmedText(data: AppNotification["data"]) {
  const parts = ["ชำระเงินเรียบร้อย"];
  if (data.queue_number) parts.push(`คิว #${data.queue_number}`);
  if (data.pickup_at) parts.push(`มารับได้เวลา ${shopTime.format(new Date(data.pickup_at))} น.`);
  return parts.join(" ");
}

function lowStockText(data: AppNotification["data"]) {
  const label = batchLabel(data);
  const remaining = count(data.remaining_portions);
  if (remaining !== undefined) return `${label ?? "Batch นี้"} เหลือ ${remaining} สกู๊ป ใกล้หมดแล้ว`;
  return label ? `${label} ใกล้หมดแล้ว` : "สต็อกของ Batch นี้ใกล้หมดแล้ว";
}

function expiringText(data: AppNotification["data"]) {
  const label = batchLabel(data);
  const expiresAt = text(data.expires_at);
  const time = expiresAt ? new Date(expiresAt) : undefined;
  if (time && !Number.isNaN(time.getTime())) return `${label ?? "Batch นี้"} จะหมดอายุ ${shopDateTime.format(time)} น.`;
  return label ? `${label} ใกล้หมดอายุแล้ว` : "Batch นี้ใกล้หมดอายุแล้ว";
}

/**
 * Thai copy for a notification, built from its type and data. Notification Service sends
 * English text; it is kept as the fallback for types this frontend does not know yet.
 */
export function notificationText(notification: AppNotification) {
  const { data } = notification;
  switch (notification.type) {
    case "order.confirmed":
      return confirmedText(data);
    case "order.ready":
      return data.queue_number ? `คิว #${data.queue_number} พร้อมแล้ว มารับที่เคาน์เตอร์ได้เลย` : "เจลาโตของคุณพร้อมแล้ว มารับที่เคาน์เตอร์ได้เลย";
    case "order.cancelled":
      return cancellationText[data.reason ?? ""] ?? "คำสั่งซื้อนี้ถูกยกเลิกแล้ว";
    case "inventory.low_stock":
      return lowStockText(data);
    case "inventory.expiring":
      return expiringText(data);
    default:
      return notification.message;
  }
}
