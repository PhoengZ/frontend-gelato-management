import { describe, expect, it } from "vitest";
import { notificationText } from "@/lib/notification-text";
import type { AppNotification } from "@/types";

const base = { id: "n1", message: "Server English text", occurred_at: "2026-11-07T10:00:00Z" };
const note = (type: AppNotification["type"], data: AppNotification["data"] = {}): AppNotification => ({ ...base, type, data });

describe("notificationText", () => {
  it("names the queue number when an order is ready", () => {
    expect(notificationText(note("order.ready", { order_id: "o", queue_number: "03" }))).toBe("คิว #03 พร้อมแล้ว มารับที่เคาน์เตอร์ได้เลย");
  });

  it("still reads well when a ready event has no queue number", () => {
    expect(notificationText(note("order.ready", { order_id: "o" }))).toBe("เจลาโตของคุณพร้อมแล้ว มารับที่เคาน์เตอร์ได้เลย");
  });

  it("tells the customer when to come for a confirmed order", () => {
    expect(notificationText(note("order.confirmed", { order_id: "o", pickup_at: "2026-11-07T10:30:00Z" }))).toBe("ชำระเงินเรียบร้อย มารับได้เวลา 17:30 น.");
  });

  it("names the queue number and pickup time once the ticket is queued", () => {
    expect(notificationText(note("order.confirmed", { order_id: "o", queue_number: "03", pickup_at: "2026-11-07T10:30:00Z" }))).toBe("ชำระเงินเรียบร้อย คิว #03 มารับได้เวลา 17:30 น.");
  });

  it("names the queue number alone when a confirmation has no pickup time", () => {
    expect(notificationText(note("order.confirmed", { order_id: "o", queue_number: "03" }))).toBe("ชำระเงินเรียบร้อย คิว #03");
  });

  it("explains an expired reservation and that stock was returned", () => {
    expect(notificationText(note("order.cancelled", { order_id: "o", reason: "RESERVATION_EXPIRED" }))).toBe("คำสั่งซื้อถูกยกเลิก เพราะชำระเงินไม่ทันเวลาที่จองไว้ ระบบคืนสต็อกแล้ว");
  });

  it("promises a store-arranged refund when the store cancels", () => {
    expect(notificationText(note("order.cancelled", { order_id: "o", reason: "STORE_CANCELLED" }))).toBe("ร้านยกเลิกคำสั่งซื้อนี้แล้ว ทางร้านจะติดต่อเพื่อคืนเงินให้คุณ");
  });

  describe("inventory alerts", () => {
    const batch = { batch_id: "b", flavor_id: "f" };

    it("names the flavor, batch and remaining portions for low stock", () => {
      expect(notificationText(note("inventory.low_stock", { ...batch, flavor_name: "Pistachio", batch_code: "GF-01", remaining_portions: 4, threshold_portions: 5 }))).toBe("Pistachio (Batch GF-01) เหลือ 4 สกู๊ป ใกล้หมดแล้ว");
    });

    it("falls back to the batch code alone for low stock", () => {
      expect(notificationText(note("inventory.low_stock", { ...batch, batch_code: "GF-01", remaining_portions: 0 }))).toBe("Batch GF-01 เหลือ 0 สกู๊ป ใกล้หมดแล้ว");
    });

    it("still reads well for low stock without names or counts", () => {
      expect(notificationText(note("inventory.low_stock", batch))).toBe("สต็อกของ Batch นี้ใกล้หมดแล้ว");
    });

    it("names the flavor and the expiry time in shop time", () => {
      expect(notificationText(note("inventory.expiring", { ...batch, flavor_name: "Mango", expires_at: "2026-11-07T10:30:00Z" }))).toBe("Mango จะหมดอายุ 7 พ.ย. 17:30 น.");
    });

    it("still reads well for an expiring batch without names or time", () => {
      expect(notificationText(note("inventory.expiring", batch))).toBe("Batch นี้ใกล้หมดอายุแล้ว");
    });
  });

  it.each([
    ["PAYMENT_FAILED", "คำสั่งซื้อถูกยกเลิก เพราะชำระเงินไม่สำเร็จ"],
    ["CUSTOMER_REQUEST", "ยกเลิกคำสั่งซื้อตามที่คุณขอแล้ว"],
    ["SOMETHING_NEW", "คำสั่งซื้อนี้ถูกยกเลิกแล้ว"]
  ])("explains a cancellation for %s", (reason, text) => {
    expect(notificationText(note("order.cancelled", { order_id: "o", reason }))).toBe(text);
  });

  it("keeps the server text for a type the frontend does not know", () => {
    expect(notificationText(note("inventory.new_thing" as AppNotification["type"]))).toBe("Server English text");
  });
});
