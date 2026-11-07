"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppNotification } from "@/types";

const MAX_NOTIFICATIONS = 50;

export interface StoredNotification extends AppNotification {
  read: boolean;
}

interface NotificationState {
  notifications: StoredNotification[];
  /** The account these notifications belong to. */
  ownerId: string | null;
  /** Not persisted: the choice lasts for the page's lifetime. */
  soundMuted: boolean;
  /**
   * Adds a notification once per source event id; returns false for a duplicate delivery or
   * when `ownerId` is no longer the current owner, i.e. a stream opened for a previous account.
   */
  add: (notification: AppNotification, ownerId: string) => boolean;
  markAllRead: () => void;
  setSoundMuted: (soundMuted: boolean) => void;
  adoptOwner: (userId: string) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      ownerId: null,
      soundMuted: false,
      add: (notification, ownerId) => {
        if (get().ownerId !== ownerId) return false;
        if (get().notifications.some((item) => item.id === notification.id)) return false;
        set((state) => ({
          notifications: [{ ...notification, read: false }, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
        }));
        return true;
      },
      markAllRead: () => set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, read: true })) })),
      setSoundMuted: (soundMuted) => set({ soundMuted }),
      // Notifications saved before owners were recorded have an undefined owner and are dropped too.
      adoptOwner: (userId) => set((state) => (state.ownerId === userId ? state : { ownerId: userId, notifications: [] })),
      reset: () => set({ ownerId: null, notifications: [] })
    }),
    {
      name: "gelatoflow-notifications",
      partialize: (state) => ({ notifications: state.notifications, ownerId: state.ownerId })
    }
  )
);

/** Fast path for a ready order; the Fulfillment ticket remains the source of truth. */
export function useReadyNotification(orderId: string) {
  return useNotificationStore((state) =>
    state.notifications.find((item) => item.type === "order.ready" && item.data.order_id === orderId)
  );
}
