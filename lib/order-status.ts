import type { FulfillmentStatus, OrderStatus } from "@/types";

const PAID_OR_LATER: OrderStatus[] = ["PAID", "PREPARING", "READY_FOR_PICKUP", "COMPLETED"];
const FINAL: OrderStatus[] = ["COMPLETED", "CANCELLED"];

export function isPaidOrLater(status: OrderStatus) {
  return PAID_OR_LATER.includes(status);
}

export function isFinalStatus(status: OrderStatus) {
  return FINAL.includes(status);
}

/**
 * The status a customer should see. Order never moves past PAID, so kitchen progress comes
 * from the Fulfillment ticket. The `order.ready` notification only moves READY_FOR_PICKUP
 * forward before the next ticket poll; it can never override a later ticket state.
 */
export function deriveOrderStatus(
  orderStatus: OrderStatus,
  ticketStatus: FulfillmentStatus | null | undefined,
  readyNotified: boolean
): OrderStatus {
  if (isFinalStatus(orderStatus)) return orderStatus;
  if (isPaidOrLater(orderStatus)) {
    if (ticketStatus === "PICKED_UP") return "COMPLETED";
    if (ticketStatus === "CANCELLED") return "CANCELLED";
    if (ticketStatus === "READY_FOR_PICKUP") return "READY_FOR_PICKUP";
  }
  if (readyNotified) return "READY_FOR_PICKUP";
  return isPaidOrLater(orderStatus) && ticketStatus === "PREPARING" ? "PREPARING" : orderStatus;
}
