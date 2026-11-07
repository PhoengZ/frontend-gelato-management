import { beforeEach, describe, expect, it } from "vitest";
import { adoptSessionUser, resetAccountState } from "@/store/account";
import { useCartStore } from "@/store/useCartStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import type { AppNotification } from "@/types";

const item = { flavorId: "v", flavorName: "Vanilla", portions: 1, unitPriceMinor: 8500 };
const checkout = { idempotencyKey: "k", order: { pickup_at: "2026-11-07T10:00:00.000Z", items: [] }, orderId: "order-a" };
const notification: AppNotification = { id: "e1", type: "order.ready", message: "ready", occurred_at: "2026-11-07T10:00:00Z", data: { order_id: "order-a" } };

describe("account-scoped stores", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [], checkout: null, ownerId: null, activeOrderId: null });
    useNotificationStore.setState({ notifications: [], ownerId: null });
  });

  it("carries an anonymous cart into the first login and records the owner", () => {
    useCartStore.setState({ items: [item] });
    adoptSessionUser("user-a");
    expect(useCartStore.getState()).toMatchObject({ items: [item], ownerId: "user-a" });
    expect(useNotificationStore.getState().ownerId).toBe("user-a");
  });

  it("wipes another user's cart, checkout, active order and notifications", () => {
    useCartStore.setState({ items: [item], checkout, activeOrderId: "order-a", ownerId: "user-a" });
    useNotificationStore.setState({ ownerId: "user-a" });
    useNotificationStore.getState().add(notification, "user-a");

    expect(adoptSessionUser("user-b")).toBe(true);

    expect(useCartStore.getState()).toMatchObject({ items: [], checkout: null, activeOrderId: null, ownerId: "user-b" });
    expect(useNotificationStore.getState()).toMatchObject({ notifications: [], ownerId: "user-b" });
  });

  it("keeps everything when the same user comes back", () => {
    useCartStore.setState({ items: [item], checkout, activeOrderId: "order-a", ownerId: "user-a" });
    useNotificationStore.setState({ ownerId: "user-a" });
    useNotificationStore.getState().add(notification, "user-a");

    expect(adoptSessionUser("user-a")).toBe(false);

    expect(useCartStore.getState()).toMatchObject({ items: [item], checkout, activeOrderId: "order-a" });
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });

  it("clears everything on logout", () => {
    useCartStore.setState({ items: [item], checkout, activeOrderId: "order-a", ownerId: "user-a" });
    useNotificationStore.setState({ ownerId: "user-a" });
    useNotificationStore.getState().add(notification, "user-a");

    resetAccountState();

    expect(useCartStore.getState()).toMatchObject({ items: [], checkout: null, activeOrderId: null, ownerId: null });
    expect(useNotificationStore.getState()).toMatchObject({ notifications: [], ownerId: null });
  });

  it("refuses a notification addressed to anyone but the current owner", () => {
    useNotificationStore.setState({ ownerId: "user-b" });
    expect(useNotificationStore.getState().add(notification, "user-a")).toBe(false);
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  it("treats a pre-owner persisted cart as anonymous and drops its checkout", async () => {
    localStorage.setItem("gelatoflow-cart", JSON.stringify({ state: { items: [item], checkout }, version: 2 }));
    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState()).toMatchObject({ items: [item], checkout: null, ownerId: null, activeOrderId: null });
  });
});

describe("active order", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [item], checkout: null, ownerId: "user-a", activeOrderId: null });
  });

  it("survives clearing the cart and checkout", () => {
    useCartStore.getState().beginCheckout("2026-11-07T10:00:00.000Z");
    useCartStore.getState().attachOrder("order-a");
    useCartStore.getState().clearCart();
    expect(useCartStore.getState()).toMatchObject({ items: [], checkout: null, activeOrderId: "order-a" });
  });

  it("is persisted", () => {
    useCartStore.getState().setActiveOrder("order-a");
    expect(JSON.parse(localStorage.getItem("gelatoflow-cart")!).state).toMatchObject({ activeOrderId: "order-a", ownerId: "user-a" });
  });

  it("clears only the order that reached a final status", () => {
    useCartStore.getState().setActiveOrder("order-b");
    useCartStore.getState().clearActiveOrder("order-a");
    expect(useCartStore.getState().activeOrderId).toBe("order-b");
    useCartStore.getState().clearActiveOrder("order-b");
    expect(useCartStore.getState().activeOrderId).toBeNull();
  });
});
