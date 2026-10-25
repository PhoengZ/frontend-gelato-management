"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
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

function showToast(notification: AppNotification) {
  const orderId = notification.data.order_id;
  toast.custom((id) => (
    <div className="flex w-full items-start gap-3 rounded-none border border-black bg-white p-4 shadow-2xl">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black bg-black text-white">
        <BellRing className="h-5 w-5 animate-bounce text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-wider text-black">{titles[notification.type]}</p>
        <p className="mt-1 text-xs text-black/80">{notification.message}</p>
        {orderId && (
          <Link
            href={`/queue/${orderId}`}
            className="mt-2 inline-block text-[11px] font-bold uppercase tracking-wider text-black underline underline-offset-4 hover:opacity-70"
            onClick={() => toast.dismiss(id)}
          >
            {notification.data.queue_number ? `ดูตั๋วคิว #${notification.data.queue_number}` : "ดูคำสั่งซื้อ"}
          </Link>
        )}
      </div>
      <button onClick={() => toast.dismiss(id)} className="text-black/40 hover:text-black" aria-label="ปิดแจ้งเตือน">
        <X className="h-4 w-4" />
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
          className="relative flex h-9 w-9 items-center justify-center border border-black/20 bg-white transition-all hover:border-black hover:bg-stone-50"
          aria-label="แจ้งเตือนสถานะคิว"
        >
          <Bell className="h-4 w-4 text-black" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center border border-black bg-black text-[9px] font-black text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="font-prompt border-l border-black bg-white p-6 sm:max-w-md">
        <SheetHeader className="border-b border-black/10 pb-4 text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-black uppercase tracking-wider text-black">
              NOTIFICATIONS
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSoundMuted(!soundMuted)}
                title={soundMuted ? "เปิดเสียงเตือน" : "ปิดเสียงเตือน"}
              >
                {soundMuted ? <VolumeX className="h-4 w-4 text-black/50" /> : <Volume2 className="h-4 w-4 text-black" />}
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[10px] font-bold uppercase tracking-wider"
                  onClick={markAllRead}
                >
                  MARK ALL READ
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-3 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-xs uppercase tracking-widest text-black/40">
              ไม่มีรายการแจ้งเตือน
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`relative border p-4 transition-all ${
                  notif.read ? "border-black/10 bg-white opacity-70" : "border-black bg-stone-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {notif.data.queue_number && (
                      <span className="font-mono text-xs font-black uppercase text-black">
                        คิว #{notif.data.queue_number}
                      </span>
                    )}
                    {!notif.read && (
                      <span className="h-2 w-2 rounded-full bg-black" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-black/50">{formatDateTime(notif.occurred_at)}</span>
                </div>
                <p className="mt-1.5 text-xs font-bold text-black">{titles[notif.type]}</p>
                <p className="mt-0.5 text-xs text-black/70">{notif.message}</p>
                {notif.data.order_id && (
                  <Link
                    href={`/queue/${notif.data.order_id}`}
                    onClick={() => setIsOpen(false)}
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-black hover:underline"
                  >
                    ดูสถานะคำสั่งซื้อ <ChevronRight className="h-3 w-3" />
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
