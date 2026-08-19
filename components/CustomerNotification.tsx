"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellRing, ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/lib/api";

export interface MockNotification {
  id: string;
  orderId: string;
  queueNumber: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  type: "READY" | "PREPARING" | "PROMO";
}

const INITIAL_MOCK_NOTIFS: MockNotification[] = [
  {
    id: "notif-1",
    orderId: "o-mock-1",
    queueNumber: "A-012",
    title: "🎉 คิวของคุณถึงแล้ว!",
    message: "ไอศกรีมเจลาโต้ คิว #A-012 พร้อมรับแล้วที่เคาน์เตอร์ครับ",
    timestamp: "เมื่อสักครู่",
    isRead: false,
    type: "READY"
  },
  {
    id: "notif-2",
    orderId: "o-mock-2",
    queueNumber: "A-011",
    title: "👨‍🍳 กำลังเตรียมเจลาโต้",
    message: "เชฟกำลังตั้งใจตัก Gelato สดใหม่สำหรับ คิว #A-011",
    timestamp: "10 นาทีที่แล้ว",
    isRead: true,
    type: "PREPARING"
  }
];

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

export function CustomerNotification() {
  const session = useSession();
  const user = session.data?.user;
  const [notifications, setNotifications] = useState<MockNotification[]>(INITIAL_MOCK_NOTIFS);
  const [soundMuted, setSoundMuted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleSimulateReady = () => {
    const nextQueueNum = `A-${Math.floor(Math.random() * 899 + 100)}`;
    const newNotif: MockNotification = {
      id: `notif-${Date.now()}`,
      orderId: `o-sim-${Date.now()}`,
      queueNumber: nextQueueNum,
      title: "🎉 คิวของคุณถึงแล้ว!",
      message: `ไอศกรีมเจลาโต้ คิว #${nextQueueNum} พร้อมรับที่เคาน์เตอร์แล้ว!`,
      timestamp: "เมื่อสักครู่",
      isRead: false,
      type: "READY"
    };

    setNotifications((prev) => [newNotif, ...prev]);

    if (!soundMuted) {
      playNotificationSound();
    }

    toast.custom((id) => (
      <div className="flex w-full items-start gap-3 rounded-none border border-black bg-white p-4 shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black bg-black text-white">
          <BellRing className="h-5 w-5 animate-bounce text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wider text-black">{newNotif.title}</p>
          <p className="mt-1 text-xs text-black/80">{newNotif.message}</p>
          <div className="mt-2 flex items-center gap-2">
            <Link
              href={`/queue/${newNotif.orderId}`}
              className="text-[11px] font-bold uppercase tracking-wider text-black underline underline-offset-4 hover:opacity-70"
              onClick={() => toast.dismiss(id)}
            >
              ดูตั๋วคิว #{newNotif.queueNumber}
            </Link>
          </div>
        </div>
        <button
          onClick={() => toast.dismiss(id)}
          className="text-black/40 hover:text-black"
          aria-label="ปิดแจ้งเตือน"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ), { duration: 6000 });
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  if (!user || user.role !== "CUSTOMER") return null;

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
                  onClick={markAllAsRead}
                >
                  MARK ALL READ
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between border border-black/10 bg-stone-50 p-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-black">ทดสอบจำลองคิวเรียก</p>
            <p className="text-[10px] text-black/60">กดปุ่มเพื่อทดสอบระบบการแจ้งเตือนคิวถึงแล้ว</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-black text-[10px] font-bold uppercase tracking-wider"
            onClick={handleSimulateReady}
          >
            TEST QUEUE CALL
          </Button>
        </div>

        <div className="mt-4 space-y-3 overflow-y-auto max-h-[calc(100vh-14rem)]">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-xs uppercase tracking-widest text-black/40">
              ไม่มีรายการแจ้งเตือน
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`relative border p-4 transition-all ${
                  notif.isRead ? "border-black/10 bg-white opacity-70" : "border-black bg-stone-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black uppercase text-black">
                      คิว #{notif.queueNumber}
                    </span>
                    {!notif.isRead && (
                      <span className="h-2 w-2 rounded-full bg-black" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-black/50">{notif.timestamp}</span>
                </div>
                <p className="mt-1.5 text-xs font-bold text-black">{notif.title}</p>
                <p className="mt-0.5 text-xs text-black/70">{notif.message}</p>
                {notif.type === "READY" && (
                  <Link
                    href={`/queue/${notif.orderId}`}
                    onClick={() => setIsOpen(false)}
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-black hover:underline"
                  >
                    ดูสถานะคิวรับสินค้า <ChevronRight className="h-3 w-3" />
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
