import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCartStore } from "@/store/useCartStore";
import type { MenuFlavor } from "@/types";

const flavor: MenuFlavor = {
  id: "6f1c7a2e-1111-4a1b-9c1d-000000000002",
  name: "Pistachio",
  description: "",
  price: { amount_minor: 9500, currency: "THB" },
  allergens: ["TREE_NUT"],
  active: true,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  available_portions: 2
};

const pickupAt = "2026-10-25T10:00:00.000Z";

describe("useCartStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [], checkout: null });
  });

  it("merges portions, respects stock, and totals in minor units", () => {
    useCartStore.getState().addItem(flavor);
    useCartStore.getState().addItem(flavor);
    useCartStore.getState().addItem(flavor);

    expect(useCartStore.getState().items).toEqual([
      expect.objectContaining({ flavorId: flavor.id, portions: 2 })
    ]);
    expect(useCartStore.getState().getTotalMinor()).toBe(19000);
  });

  it("replays one checkout for retries and starts a new one when the cart or pickup changes", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    useCartStore.getState().addItem(flavor);
    const first = useCartStore.getState().beginCheckout(pickupAt);
    expect(first.order).toEqual({ pickup_at: pickupAt, items: [{ flavor_id: flavor.id, portions: 1 }] });
    expect(useCartStore.getState().beginCheckout(pickupAt)).toBe(first);

    const later = useCartStore.getState().beginCheckout("2026-10-25T10:15:00.000Z");
    expect(later.idempotencyKey).toBe("00000000-0000-4000-8000-000000000002");

    useCartStore.getState().updatePortion(flavor.id, 2);
    expect(useCartStore.getState().checkout).toBeNull();
  });

  it("remembers the order created by a checkout", () => {
    useCartStore.getState().addItem(flavor);
    useCartStore.getState().beginCheckout(pickupAt);
    useCartStore.getState().attachOrder("8d29d6cf-bd4d-48ca-9e4f-dcd8ec54e594");
    expect(useCartStore.getState().checkout?.orderId).toBe("8d29d6cf-bd4d-48ca-9e4f-dcd8ec54e594");
  });

  it("removes zero-portion items and clears the completed cart", () => {
    useCartStore.getState().addItem(flavor);
    useCartStore.getState().updatePortion(flavor.id, 0);
    expect(useCartStore.getState().items).toHaveLength(0);

    useCartStore.getState().addItem(flavor);
    useCartStore.getState().clearCart();
    expect(useCartStore.getState()).toMatchObject({ items: [], checkout: null });
  });
});
