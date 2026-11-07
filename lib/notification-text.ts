import type { AppNotification } from "@/types";

/** Pickup times are the shop's local time, whatever timezone the customer's device uses. */
const shopTime = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

const cancellationText: Record<string, string> = {
  PAYMENT_FAILED: "คำสั่งซื้อถูกยกเลิก เพราะชำระเงินไม่สำเร็จ",
  CUSTOMER_REQUEST: "ยกเลิกคำสั่งซื้อตามที่คุณขอแล้ว"
};

/**
 * Thai copy for a notification, built from its type and data. Notification Service sends
 * English text; it is kept as the fallback for types this frontend does not know yet.
 */
export function notificationText(notification: AppNotification) {
  const { data } = notification;
  switch (notification.type) {
    case "order.confirmed":
      return data.pickup_at ? `ชำระเงินเรียบร้อย มารับได้เวลา ${shopTime.format(new Date(data.pickup_at))} น.` : "ชำระเงินเรียบร้อย";
    case "order.ready":
      return data.queue_number ? `คิว #${data.queue_number} พร้อมแล้ว มารับที่เคาน์เตอร์ได้เลย` : "เจลาโตของคุณพร้อมแล้ว มารับที่เคาน์เตอร์ได้เลย";
    case "order.cancelled":
      return cancellationText[data.reason ?? ""] ?? "คำสั่งซื้อนี้ถูกยกเลิกแล้ว";
    case "inventory.low_stock":
      return "สต็อกของ Batch นี้ใกล้หมดแล้ว";
    case "inventory.expiring":
      return "Batch นี้ใกล้หมดอายุแล้ว";
    default:
      return notification.message;
  }
}
