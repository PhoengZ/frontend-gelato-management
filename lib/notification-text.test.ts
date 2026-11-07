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
