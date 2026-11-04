"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { useNotificationStore } from "@/store/useNotificationStore";
import type { AppNotification, NotificationType } from "@/types";

const NOTIFICATION_TYPES: NotificationType[] = ["order.confirmed", "order.ready", "order.cancelled"];
const RECONNECT_DELAY_MS = 15_000;

const titles: Record<NotificationType, string> = {
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
        <p className="text-sm font-semibold">{titles[notification.type]}</p>
        <p className="mt-0.5 text-xs text-canvas/70">{notification.message}</p>
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
 * Subscribes to the Notification Service SSE stream through the same-origin proxy, which
 * turns the session cookie into a Bearer token. Delivery is best effort and not replayed,
 * so order pages keep polling Order as the source of truth.
 */
function useNotificationStream(enabled: boolean, soundMuted: boolean) {
  const add = useNotificationStore((state) => state.add);
  const muted = useRef(soundMuted);

  useEffect(() => {
    muted.current = soundMuted;
  }, [soundMuted]);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const onNotification = (event: MessageEvent<string>) => {
      try {
        const notification = JSON.parse(event.data) as AppNotification;
        if (!add(notification)) return;
        if (!muted.current) playNotificationSound();
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
  }, [enabled, add]);
}

export function CustomerNotification() {
  const session = useSession();
  const user = session.data;
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const [soundMuted, setSoundMuted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const isCustomer = user?.role === "CUSTOMER";

  useNotificationStream(isCustomer, soundMuted);

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!isCustomer) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          className="relative grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5"
          aria-label={unreadCount ? `แจ้งเตือนสถานะคิว (${unreadCount} รายการใหม่)` : "แจ้งเตือนสถานะคิว"}
        >
          <Bell className="h-[22px] w-[22px]" strokeWidth={1.75} />
          {unreadCount > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-pink" aria-hidden="true" />}
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader className="flex flex-row items-center justify-between space-y-0">
          <SheetTitle>การแจ้งเตือน</SheetTitle>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink/5"
              onClick={() => setSoundMuted(!soundMuted)}
              aria-label={soundMuted ? "เปิดเสียงเตือน" : "ปิดเสียงเตือน"}
            >
              {soundMuted ? <VolumeX className="h-5 w-5 text-subtle" /> : <Volume2 className="h-5 w-5" />}
            </button>
            {unreadCount > 0 && (
              <button type="button" className="h-9 rounded-full px-3 text-sm font-medium hover:bg-ink/5" onClick={markAllRead}>
                อ่านทั้งหมด
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-2.5">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="mx-auto h-8 w-8 text-line" />
              <p className="mt-3 text-sm text-subtle">ยังไม่มีการแจ้งเตือน</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div key={notif.id} className={cn("rounded-3xl border border-line p-4", notif.read ? "opacity-70" : "bg-white")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {!notif.read && <span className="h-2 w-2 rounded-full bg-pink" aria-label="ยังไม่ได้อ่าน" />}
                    {titles[notif.type]}
                  </p>
                  <span className="shrink-0 text-xs text-subtle">{formatDateTime(notif.occurred_at)}</span>
                </div>
                <p className="mt-1 text-[13px] text-subtle">
                  {notif.data.queue_number && `คิว #${notif.data.queue_number} · `}
                  {notif.message}
                </p>
                {notif.data.order_id && (
                  <Link href={`/queue/${notif.data.order_id}`} onClick={() => setIsOpen(false)} className="mt-2 inline-flex items-center gap-0.5 text-sm font-medium hover:underline">
                    ดูสถานะคำสั่งซื้อ <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
