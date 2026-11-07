"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { notificationTitles } from "@/components/NotificationStream";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { useNotificationStore } from "@/store/useNotificationStore";

/** The bell and history sheet. The stream itself lives in NotificationStream, mounted by the layout. */
export function CustomerNotification() {
  const session = useSession();
  const user = session.data;
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const soundMuted = useNotificationStore((state) => state.soundMuted);
  const setSoundMuted = useNotificationStore((state) => state.setSoundMuted);
  const [isOpen, setIsOpen] = useState(false);
  const isCustomer = user?.role === "CUSTOMER";

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
                    {notificationTitles[notif.type]}
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
