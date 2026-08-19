"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellOff, BellRing, CheckCircle2, ChefHat, Clock3, Loader2, ReceiptText, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQueueStatus } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import type { OrderStatus } from "@/types";
import cookieMascot from "@/public/cookie-mascot.png";

interface StatusView {
  title: string;
  description: string;
  badge: string;
  panel: string;
  icon: LucideIcon;
}

const statusView: Record<OrderStatus, StatusView> = {
  PAID: {
    title: "PAID — ORDER CONFIRMED",
    description: "รับออเดอร์แล้ว กำลังส่งเข้าคิวเตรียม Gelato",
    badge: "border border-black/20 bg-stone-100 text-black",
    panel: "border-black/20 bg-white",
    icon: ReceiptText
  },
  PREPARING: {
    title: "PREPARING GELATO",
    description: "เชฟกำลังตั้งใจตัก Gelato สดใหม่สำหรับคุณ...",
    badge: "border border-black bg-black text-white",
    panel: "border-black bg-white",
    icon: ChefHat
  },
  READY: {
    title: "READY FOR PICKUP",
    description: "เจลาโต้ของคุณพร้อมแล้ว! แสดงหน้าจอนี้แก่พนักงานที่เคาน์เตอร์",
    badge: "border border-black bg-black text-white animate-pulse",
    panel: "border-black bg-stone-50",
    icon: BellRing
  },
  PICKED_UP: {
    title: "ORDER COMPLETED",
    description: "รับสินค้าเรียบร้อยแล้ว ขอให้มีความสุขกับ Gelato ครับ",
    badge: "border border-black/20 bg-stone-100 text-black/60",
    panel: "border-black/10 bg-white",
    icon: CheckCircle2
  }
};

function playReadyTone() {
  const AudioContextClass = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.setValueAtTime(880, context.currentTime + 0.14);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.36);
  oscillator.addEventListener("ended", () => void context.close());
}

export function QueueTracker({ orderId }: { orderId: string }) {
  const queue = useQueueStatus(orderId);
  const reduceMotion = useReducedMotion();
  const previousStatus = useRef<OrderStatus | undefined>(undefined);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    if (queue.data?.status === "READY" && previousStatus.current && previousStatus.current !== "READY" && soundEnabled) {
      playReadyTone();
    }
    if (queue.data?.status) previousStatus.current = queue.data.status;
  }, [queue.data?.status, soundEnabled]);

  if (queue.isLoading) {
    return (
      <main className="grid min-h-[75vh] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-black" />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-black/60">LOCATING QUEUE POSITION...</p>
        </div>
      </main>
    );
  }

  if (queue.isError || !queue.data) {
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-6 text-center">
        <div className="border border-black bg-white p-10">
          <h1 className="text-xl font-bold uppercase tracking-wider text-black">QUEUE NOT FOUND</h1>
          <p className="mt-2 text-xs uppercase tracking-widest text-black/60">ไม่พบหมายเลขคิวนี้ในระบบ</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="outline" onClick={() => void queue.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> RETRY
            </Button>
            <Button asChild>
              <Link href="/">RETURN TO COLLECTION</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const order = queue.data;
  const view = statusView[order.status];
  const Icon = view.icon;
  const ready = order.status === "READY";

  return (
    <main className="font-prompt mx-auto max-w-2xl px-6 pb-24 pt-10 sm:pt-14">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-black pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-black">YOUR QUEUE TICKET</p>
          <p className="mt-0.5 font-mono text-[11px] font-medium text-black/60">ISSUED AT {formatTime(order.createdAt)} N.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            if (next) playReadyTone();
          }}
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? <BellRing className="mr-2 h-3.5 w-3.5" /> : <BellOff className="mr-2 h-3.5 w-3.5" />}
          {soundEnabled ? "SOUND ON" : "ENABLE NOTIFICATION"}
        </Button>
      </div>

      <motion.section
        animate={ready && !reduceMotion ? { scale: [1, 1.01, 1] } : undefined}
        transition={ready && !reduceMotion ? { repeat: Infinity, duration: 1.8 } : undefined}
      >
        <Card className="relative overflow-hidden border border-black bg-[#f79bad] p-8 text-center sm:p-14 shadow-2xl transition-all">
          {/* Floating Cookie Mascot Artworks around the edges */}
          <div className="pointer-events-none absolute -left-5 -top-5 z-0 h-24 w-24 -rotate-12 opacity-85 sm:h-32 sm:w-32">
            <Image src={cookieMascot} alt="" fill className="object-contain" />
          </div>
          <div className="pointer-events-none absolute -right-6 -bottom-6 z-0 h-28 w-28 rotate-12 opacity-85 sm:h-36 sm:w-36">
            <Image src={cookieMascot} alt="" fill className="object-contain" />
          </div>
          <div className="pointer-events-none absolute -bottom-4 left-6 z-0 h-20 w-20 -rotate-45 opacity-60 sm:h-24 sm:w-24">
            <Image src={cookieMascot} alt="" fill className="object-contain" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={order.status}
              initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="relative z-10"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center border border-black bg-white shadow-sm">
                <Icon className="h-8 w-8 text-black" />
              </div>
              <div className="mt-8 font-mono text-[clamp(4.5rem,18vw,8rem)] font-black leading-none tracking-tighter text-[#32111c]" aria-label={`คิว ${order.queueNumber}`}>
                #{order.queueNumber}
              </div>
              <Badge className={`mt-8 px-4 py-2 text-xs uppercase tracking-widest font-bold ${view.badge}`}>
                {view.title}
              </Badge>
              <p className="mx-auto mt-6 max-w-md text-sm font-bold leading-relaxed uppercase tracking-wider text-[#4a1424]">{view.description}</p>
            </motion.div>
          </AnimatePresence>
        </Card>
      </motion.section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4 border border-black/10 bg-white p-6">
          <div className="flex h-12 w-12 items-center justify-center border border-black bg-stone-50">
            <Clock3 className="h-5 w-5 text-black" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/60">ESTIMATED WAIT TIME</p>
            <p className="font-mono text-base font-bold text-black">{order.status === "PICKED_UP" ? "COMPLETED" : ready ? "READY NOW" : `${order.estimatedWaitMinutes} MINS`}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 border border-black/10 bg-white p-6">
          <div className="flex h-12 w-12 items-center justify-center border border-black bg-stone-50">
            <span className={`relative flex h-3 w-3 ${order.status !== "PICKED_UP" ? "animate-pulse" : ""}`}>
              <span className="absolute inline-flex h-full w-full rounded-full bg-black opacity-40" />
              <span className="relative h-3 w-3 rounded-full bg-black" />
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/60">LIVE SYNC STATUS</p>
            <p className="font-mono text-base font-bold text-black">EVERY 3 SECONDS</p>
          </div>
        </Card>
      </section>

      {order.status === "PICKED_UP" && (
        <Button asChild className="mt-8 h-12 w-full">
          <Link href="/">ORDER AGAIN</Link>
        </Button>
      )}
    </main>
  );
}
