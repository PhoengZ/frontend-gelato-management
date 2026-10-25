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
  /** Adds a notification once per source event id; returns false for a duplicate delivery. */
  add: (notification: AppNotification) => boolean;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      add: (notification) => {
        if (get().notifications.some((item) => item.id === notification.id)) return false;
        set((state) => ({
          notifications: [{ ...notification, read: false }, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
        }));
        return true;
      },
      markAllRead: () => set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, read: true })) })),
      clear: () => set({ notifications: [] })
    }),
    { name: "gelatoflow-notifications" }
  )
);

/** The queue number only reaches customers through the `order.ready` notification. */
export function useReadyNotification(orderId: string) {
  return useNotificationStore((state) =>
    state.notifications.find((item) => item.type === "order.ready" && item.data.order_id === orderId)
  );
}
