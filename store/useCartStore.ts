"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, CreateOrderRequest, MenuFlavor } from "@/types";

/**
 * A checkout attempt. Order deduplicates by Idempotency-Key *and* request body, so the
 * exact body is kept with its key to replay the same order (e.g. to get the Stripe URL again).
 */
export interface PendingCheckout {
  idempotencyKey: string;
  order: CreateOrderRequest;
  orderId?: string;
}

interface CartState {
  items: CartItem[];
  checkout: PendingCheckout | null;
  /** The account this state belongs to; null for an anonymous cart. */
  ownerId: string | null;
  /** The order the customer is following, kept apart from the cart so paying does not lose it. */
  activeOrderId: string | null;
  /**
   * The order whose payment result the customer has not seen. Unlike `checkout` it survives cart
   * edits, because the customer may already have paid for it in a closed Stripe tab.
   */
  unsettledOrderId: string | null;
  addItem: (flavor: MenuFlavor) => void;
  removeItem: (flavorId: string) => void;
  updatePortion: (flavorId: string, portions: number) => void;
  clearCart: () => void;
  beginCheckout: (pickupAt: string) => PendingCheckout;
  attachOrder: (orderId: string) => void;
  discardCheckout: () => void;
  settleOrder: (orderId: string) => void;
  setActiveOrder: (orderId: string) => void;
  clearActiveOrder: (orderId: string) => void;
  /** Binds the state to a signed-in user; returns true when another user's data was discarded. */
  adoptOwner: (userId: string) => boolean;
  reset: () => void;
  getTotalMinor: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      checkout: null,
      ownerId: null,
      activeOrderId: null,
      unsettledOrderId: null,
      addItem: (flavor) => {
        if (!flavor.active || flavor.available_portions <= 0) return;

        set((state) => {
          const existing = state.items.find((item) => item.flavorId === flavor.id);
          if (existing) {
            if (existing.portions >= flavor.available_portions) return state;
            return {
              checkout: null,
              items: state.items.map((item) =>
                item.flavorId === flavor.id ? { ...item, portions: item.portions + 1 } : item
              )
            };
          }

          return {
            checkout: null,
            items: [
              ...state.items,
              {
                flavorId: flavor.id,
                flavorName: flavor.name,
                portions: 1,
                unitPriceMinor: flavor.price.amount_minor
              }
            ]
          };
        });
      },
      removeItem: (flavorId) =>
        set((state) => ({
          items: state.items.filter((item) => item.flavorId !== flavorId),
          checkout: null
        })),
      updatePortion: (flavorId, portions) =>
        set((state) => ({
          items:
            portions <= 0
              ? state.items.filter((item) => item.flavorId !== flavorId)
              : state.items.map((item) =>
                  item.flavorId === flavorId ? { ...item, portions: Math.floor(portions) } : item
                ),
          checkout: null
        })),
      clearCart: () => set({ items: [], checkout: null }),
      beginCheckout: (pickupAt) => {
        const existing = get().checkout;
        if (existing?.order.pickup_at === pickupAt) return existing;
        const checkout: PendingCheckout = {
          idempotencyKey: crypto.randomUUID(),
          order: {
            pickup_at: pickupAt,
            items: get().items.map((item) => ({ flavor_id: item.flavorId, portions: item.portions }))
          }
        };
        set({ checkout });
        return checkout;
      },
      attachOrder: (orderId) =>
        set((state) => (state.checkout ? { checkout: { ...state.checkout, orderId }, activeOrderId: orderId, unsettledOrderId: orderId } : state)),
      discardCheckout: () => set({ checkout: null }),
      settleOrder: (orderId) => set((state) => (state.unsettledOrderId === orderId ? { unsettledOrderId: null } : state)),
      setActiveOrder: (orderId) => set({ activeOrderId: orderId }),
      clearActiveOrder: (orderId) => set((state) => (state.activeOrderId === orderId ? { activeOrderId: null } : state)),
      adoptOwner: (userId) => {
        const { ownerId } = get();
        if (ownerId === userId) return false;
        // Only an anonymous cart's items carry over; a checkout or order always has a known owner.
        if (ownerId === null) {
          set({ ownerId: userId, checkout: null, activeOrderId: null, unsettledOrderId: null });
          return false;
        }
        set({ ownerId: userId, items: [], checkout: null, activeOrderId: null, unsettledOrderId: null });
        return true;
      },
      reset: () => set({ ownerId: null, items: [], checkout: null, activeOrderId: null, unsettledOrderId: null }),
      getTotalMinor: () =>
        get().items.reduce((total, item) => total + item.unitPriceMinor * item.portions, 0)
    }),
    {
      name: "gelatoflow-cart",
      version: 3,
      migrate: (persisted, version) => ({
        // v1 carts held demo flavor IDs and baht prices that the backend does not know.
        items: version === 2 ? ((persisted as { items?: CartItem[] }).items ?? []) : [],
        // v2 recorded no owner, so its checkout may be another account's order.
        checkout: null,
        ownerId: null,
        activeOrderId: null,
        unsettledOrderId: null
      }),
      partialize: (state) => ({ items: state.items, checkout: state.checkout, ownerId: state.ownerId, activeOrderId: state.activeOrderId, unsettledOrderId: state.unsettledOrderId })
    }
  )
);
