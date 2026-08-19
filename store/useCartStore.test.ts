import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCartStore } from "@/store/useCartStore";
import type { Flavor } from "@/types";

const flavor: Flavor = {
  id: "pistachio",
  name: "Pistachio",
  description: "",
  pricePerPortion: 95,
  allergens: ["Nuts"],
  availablePortions: 2,
  imageUrl: "/flavor.svg",
  isAvailable: true
};

describe("useCartStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [], idempotencyKey: null });
  });

  it("merges portions, respects stock, and calculates the total", () => {
    const cart = useCartStore.getState();
    cart.addItem(flavor);
    useCartStore.getState().addItem(flavor);
    useCartStore.getState().addItem(flavor);

    expect(useCartStore.getState().items).toEqual([
      expect.objectContaining({ flavorId: "pistachio", portions: 2 })
    ]);
    expect(useCartStore.getState().getTotalPrice()).toBe(190);
  });

  it("keeps one key for retries and clears it when the cart changes", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    useCartStore.getState().addItem(flavor);
    const first = useCartStore.getState().beginCheckout();
    const retry = useCartStore.getState().beginCheckout();
    expect(first).toBe(retry);

    useCartStore.getState().updatePortion(flavor.id, 2);
    expect(useCartStore.getState().idempotencyKey).toBeNull();
  });

  it("removes zero-portion items and clears the completed cart", () => {
    useCartStore.getState().addItem(flavor);
    useCartStore.getState().updatePortion(flavor.id, 0);
    expect(useCartStore.getState().items).toHaveLength(0);

    useCartStore.getState().addItem(flavor);
    useCartStore.getState().clearCart();
    expect(useCartStore.getState()).toMatchObject({ items: [], idempotencyKey: null });
  });
});
