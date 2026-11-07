"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BellRing, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/api";
import { adoptSessionUser } from "@/store/account";
import { useNotificationStore } from "@/store/useNotificationStore";
import type { AppNotification, NotificationType } from "@/types";import { notificationText } from "@/lib/notification-text";


const NOTIFICATION_TYPES: NotificationType[] = ["order.confirmed", "order.ready", "order.cancelled"];
const RECONNECT_DELAY_MS = 15_000;

export const notificationTitles: Record<NotificationType, string> = {
  "order.confirmed": "✅ ยืนยันคำสั่งซื้อแล้ว",
  "order.ready": "🎉 คิวของคุณถึงแล้ว!",
  "order.cancelled": "คำสั่งซื้อถูกยกเลิก",
  "inventory.low_stock": "สต็อกใกล้หมด",
  "inventory.expiring": "Batch ใกล้หมดอายุ"
};

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.addEventListener("ended", () => void ctx.close());
  } catch {
    // Audio Context fallback
  }
}

/** Ink toast with a pink bell (Figma: Toast). */
function showToast(notification: AppNotification) {
  const orderId = notification.data.order_id;
  toast.custom((id) => (
    <div className="flex w-[min(calc(100vw-2rem),22.375rem)] items-start gap-3 rounded-3xl bg-ink p-3.5 text-canvas shadow-float">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink text-ink">
        <BellRing className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{notificationTitles[notification.type]}</p>
        <p className="mt-0.5 text-xs text-canvas/70">{notificationText(notification)}</p>
        {orderId && (
          <Link href={`/queue/${orderId}`} className="mt-2 inline-flex items-center gap-0.5 text-xs font-semibold underline-offset-4 hover:underline" onClick={() => toast.dismiss(id)}>
            {notification.data.queue_number ? `ดูตั๋วคิว #${notification.data.queue_number}` : "ดูคำสั่งซื้อ"} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <button onClick={() => toast.dismiss(id)} className="text-canvas/60 hover:text-canvas" aria-label="ปิดแจ้งเตือน">
        <X className="h-[18px] w-[18px]" />
      </button>
    </div>
  ), { duration: 6000 });
}

/**
 * Subscribes to the Notification Service SSE stream through the same-origin proxy, which turns
 * the session cookie into a Bearer token. Delivery is best effort and not replayed, so this is
 * only a fast path: QueueTracker polls Order and the Fulfillment ticket as the source of truth.
 * Writes are tagged with the user the stream was opened for, so a frame arriving after a logout
 * or an account switch is refused by the store.
 */
function useNotificationStream(userId: string | null) {
  useEffect(() => {
    if (!userId || typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const onNotification = (event: MessageEvent<string>) => {
      try {
        const notification = JSON.parse(event.data) as AppNotification;
        const store = useNotificationStore.getState();
        if (!store.add(notification, userId)) return;
        if (!store.soundMuted) playNotificationSound();
        showToast(notification);
      } catch {
        // Ignore malformed frames.
      }
    };

    const connect = () => {
      source = new EventSource("/api/v1/notifications/stream");
      for (const type of NOTIFICATION_TYPES) source.addEventListener(type, onNotification as EventListener);
      source.onerror = () => {
        // The browser retries dropped connections itself; a rejected one (e.g. 401) is closed.
        if (source?.readyState === EventSource.CLOSED) retry = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();
    return () => {
      clearTimeout(retry);
      source?.close();
    };
  }, [userId]);
}

/**
 * Mounted once by the root layout so the subscription survives route changes, including pages
 * whose header has no bell. It also keeps the browser-wide stores bound to the session user.
 */
export function NotificationStream() {
  const session = useSession();
  const user = session.data;
  const userId = user?.id;
  const ownerId = useNotificationStore((state) => state.ownerId);

  useEffect(() => {
    if (userId) adoptSessionUser(userId);
  }, [userId]);

  // Watching the owner also closes the stream on logout, which clears the store.
  useNotificationStream(user?.role === "CUSTOMER" && user.id === ownerId ? user.id : null);

  return null;
}
