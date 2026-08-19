"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Flavor } from "@/types";

interface CartState {
  items: CartItem[];
  idempotencyKey: string | null;
  addItem: (flavor: Flavor) => void;
  removeItem: (flavorId: string) => void;
  updatePortion: (flavorId: string, portions: number) => void;
  clearCart: () => void;
  beginCheckout: () => string;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      idempotencyKey: null,
      addItem: (flavor) => {
        if (!flavor.isAvailable || flavor.availablePortions <= 0) return;

        set((state) => {
          const existing = state.items.find((item) => item.flavorId === flavor.id);
          if (existing) {
            if (existing.portions >= flavor.availablePortions) return state;
            return {
              idempotencyKey: null,
              items: state.items.map((item) =>
                item.flavorId === flavor.id ? { ...item, portions: item.portions + 1 } : item
              )
            };
          }

          return {
            idempotencyKey: null,
            items: [
              ...state.items,
              {
                flavorId: flavor.id,
                flavorName: flavor.name,
                portions: 1,
                unitPrice: flavor.pricePerPortion
              }
            ]
          };
        });
      },
      removeItem: (flavorId) =>
        set((state) => ({
          items: state.items.filter((item) => item.flavorId !== flavorId),
          idempotencyKey: null
        })),
      updatePortion: (flavorId, portions) =>
        set((state) => ({
          items:
            portions <= 0
              ? state.items.filter((item) => item.flavorId !== flavorId)
              : state.items.map((item) =>
                  item.flavorId === flavorId ? { ...item, portions: Math.floor(portions) } : item
                ),
          idempotencyKey: null
        })),
      clearCart: () => set({ items: [], idempotencyKey: null }),
      beginCheckout: () => {
        const existing = get().idempotencyKey;
        if (existing) return existing;
        const key = crypto.randomUUID();
        set({ idempotencyKey: key });
        return key;
      },
      getTotalPrice: () =>
        get().items.reduce((total, item) => total + item.unitPrice * item.portions, 0)
    }),
    {
      name: "gelatoflow-cart",
      partialize: (state) => ({ items: state.items, idempotencyKey: state.idempotencyKey })
    }
  )
);
