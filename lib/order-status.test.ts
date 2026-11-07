import { describe, expect, it } from "vitest";
import { deriveOrderStatus, isFinalStatus, isPaidOrLater, isWaitingInQueue } from "@/lib/order-status";

describe("isWaitingInQueue", () => {
  it("is true for a paid order whose ticket is queued in the kitchen", () => {
    expect(isWaitingInQueue("PAID", "QUEUED")).toBe(true);
  });

  it("is false before payment, once preparation starts, or without a ticket", () => {
    expect(isWaitingInQueue("PENDING_PAYMENT", "QUEUED")).toBe(false);
    expect(isWaitingInQueue("CANCELLED", "QUEUED")).toBe(false);
    expect(isWaitingInQueue("PAID", "PREPARING")).toBe(false);
    expect(isWaitingInQueue("PAID", null)).toBe(false);
  });
});

describe("deriveOrderStatus", () => {
  it("keeps a queued ticket at PAID: paid and waiting for the kitchen", () => {
    expect(deriveOrderStatus("PAID", "QUEUED", false)).toBe("PAID");
    expect(deriveOrderStatus("PAID", "QUEUED", true)).toBe("READY_FOR_PICKUP");
  });

  it("derives kitchen progress from the ticket because Order stays at PAID", () => {
    expect(deriveOrderStatus("PAID", undefined, false)).toBe("PAID");
    expect(deriveOrderStatus("PAID", null, false)).toBe("PAID");
    expect(deriveOrderStatus("PAID", "PREPARING", false)).toBe("PREPARING");
    expect(deriveOrderStatus("PAID", "READY_FOR_PICKUP", false)).toBe("READY_FOR_PICKUP");
    expect(deriveOrderStatus("PAID", "PICKED_UP", false)).toBe("COMPLETED");
    expect(deriveOrderStatus("PAID", "CANCELLED", false)).toBe("CANCELLED");
  });

  it("uses the notification only as a fast path", () => {
    expect(deriveOrderStatus("PAID", null, true)).toBe("READY_FOR_PICKUP");
    expect(deriveOrderStatus("PAID", "PREPARING", true)).toBe("READY_FOR_PICKUP");
    expect(deriveOrderStatus("PAID", "PICKED_UP", true)).toBe("COMPLETED");
    expect(deriveOrderStatus("CANCELLED", undefined, true)).toBe("CANCELLED");
  });

  it("ignores a ticket for an order that has not been paid", () => {
    expect(deriveOrderStatus("PENDING_PAYMENT", "PICKED_UP", false)).toBe("PENDING_PAYMENT");
  });

  it("classifies statuses", () => {
    expect(isPaidOrLater("PAYMENT_CONFIRMING")).toBe(false);
    expect(isPaidOrLater("PAID")).toBe(true);
    expect(isPaidOrLater("COMPLETED")).toBe(true);
    expect(isFinalStatus("COMPLETED")).toBe(true);
    expect(isFinalStatus("READY_FOR_PICKUP")).toBe(false);
  });
});
