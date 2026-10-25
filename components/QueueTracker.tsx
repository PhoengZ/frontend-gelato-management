"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellOff, BellRing, CheckCircle2, ChefHat, Clock3, CreditCard, Loader2, ReceiptText, RefreshCw, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCancelOrder, useCreateOrder, useOrder } from "@/lib/api";
import { formatMinor, formatTime } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";
import { useReadyNotification } from "@/store/useNotificationStore";
import type { OrderStatus } from "@/types";
import cookieMascot from "@/public/cookie-mascot.png";

interface StatusView {
  title: string;
  description: string;
  badge: string;
  icon: LucideIcon;
}

const muted = "border border-black/20 bg-stone-100 text-black";
const strong = "border border-black bg-black text-white";

const statusView: Record<OrderStatus, StatusView> = {
  PENDING_PAYMENT: {
    title: "AWAITING PAYMENT",
    description: "จองสต็อกไว้ให้แล้ว กรุณาชำระเงินให้เสร็จก่อนหมดเวลาจอง",
    badge: muted,
    icon: CreditCard
  },
  PAYMENT_CONFIRMING: {
    title: "CONFIRMING PAYMENT",
    description: "ได้รับผลการชำระเงินแล้ว กำลังยืนยันสต็อก...",
    badge: muted,
    icon: Loader2
  },
  CANCEL_PENDING: {
    title: "CANCELLING ORDER",
    description: "กำลังยกเลิกคำสั่งซื้อและคืนสต็อก...",
    badge: muted,
    icon: Loader2
  },
  PAID: {
    title: "PAID — ORDER CONFIRMED",
    description: "รับออเดอร์แล้ว กำลังส่งเข้าคิวเตรียม Gelato",
    badge: muted,
    icon: ReceiptText
  },
  PREPARING: {
    title: "PREPARING GELATO",
    description: "เชฟกำลังตั้งใจตัก Gelato สดใหม่สำหรับคุณ...",
    badge: strong,
    icon: ChefHat
  },
  READY_FOR_PICKUP: {
    title: "READY FOR PICKUP",
    description: "เจลาโต้ของคุณพร้อมแล้ว! แสดงหน้าจอนี้แก่พนักงานที่เคาน์เตอร์",
    badge: `${strong} animate-pulse`,
    icon: BellRing
  },
  COMPLETED: {
    title: "ORDER COMPLETED",
    description: "รับสินค้าเรียบร้อยแล้ว ขอให้มีความสุขกับ Gelato ครับ",
    badge: "border border-black/20 bg-stone-100 text-black/60",
    icon: CheckCircle2
  },
  CANCELLED: {
    title: "ORDER CANCELLED",
    description: "คำสั่งซื้อนี้ถูกยกเลิกและคืนสต็อกแล้ว",
    badge: "border border-black/20 bg-stone-100 text-black/60",
    icon: XCircle
  }
};

const unpaidStatuses: OrderStatus[] = ["PENDING_PAYMENT", "CANCEL_PENDING", "PAYMENT_CONFIRMING", "CANCELLED"];

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
  const query = useOrder(orderId);
  const readyNotification = useReadyNotification(orderId);
  const cancelOrder = useCancelOrder();
  const createOrder = useCreateOrder();
  const checkout = useCartStore((state) => state.checkout);
  const clearCart = useCartStore((state) => state.clearCart);
  const discardCheckout = useCartStore((state) => state.discardCheckout);
  const reduceMotion = useReducedMotion();
  const wasReady = useRef<boolean | undefined>(undefined);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const order = query.data;
  // Order does not track the kitchen yet; the queue number arrives with the `order.ready` notification.
  const status: OrderStatus | undefined =
    order && readyNotification && !["COMPLETED", "CANCELLED"].includes(order.status) ? "READY_FOR_PICKUP" : order?.status;
  const ready = status === "READY_FOR_PICKUP";
  const queueNumber = readyNotification?.data.queue_number;
  const ownsCheckout = checkout?.orderId === orderId;

  useEffect(() => {
    if (ready && wasReady.current === false && soundEnabled) playReadyTone();
    if (status) wasReady.current = ready;
  }, [ready, status, soundEnabled]);

  useEffect(() => {
    if (!ownsCheckout || !order) return;
    if (order.status === "CANCELLED") discardCheckout();
    else if (!unpaidStatuses.includes(order.status)) clearCart();
  }, [ownsCheckout, order, clearCart, discardCheckout]);

  const continuePayment = () => {
    if (!checkout) return;
    createOrder.mutate(
      { order: checkout.order, idempotencyKey: checkout.idempotencyKey },
      {
        onSuccess: (replay) => {
          if (replay.checkout_url) window.location.assign(replay.checkout_url);
          else void query.refetch();
        },
        onError: (error) => toast.error(error.message)
      }
    );
  };

  const cancel = () => {
    cancelOrder.mutate(orderId, {
      onSuccess: () => toast.success("ยกเลิกคำสั่งซื้อแล้ว"),
      onError: (error) => toast.error(error.message)
    });
  };

  if (query.isLoading) {
    return (
      <main className="grid min-h-[75vh] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-black" />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-black/60">LOADING YOUR ORDER...</p>
        </div>
      </main>
    );
  }

  if (query.isError || !order || !status) {
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-6 text-center">
        <div className="border border-black bg-white p-10">
          <h1 className="text-xl font-bold uppercase tracking-wider text-black">ORDER NOT FOUND</h1>
          <p className="mt-2 text-xs uppercase tracking-widest text-black/60">ไม่พบคำสั่งซื้อนี้ในบัญชีของคุณ</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="outline" onClick={() => void query.refetch()}>
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

  const view = statusView[status];
  const Icon = view.icon;
  const spinning = status === "PAYMENT_CONFIRMING" || status === "CANCEL_PENDING";

  return (
    <main className="font-prompt mx-auto max-w-2xl px-6 pb-24 pt-10 sm:pt-14">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-black pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-black">YOUR ORDER</p>
          <p className="mt-0.5 font-mono text-[11px] font-medium text-black/60">PLACED AT {formatTime(order.created_at)} N.</p>
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
              key={status}
              initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="relative z-10"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center border border-black bg-white shadow-sm">
                <Icon className={`h-8 w-8 text-black ${spinning ? "animate-spin" : ""}`} />
              </div>
              {queueNumber ? (
                <div className="mt-8 font-mono text-[clamp(4.5rem,18vw,8rem)] font-black leading-none tracking-tighter text-[#32111c]" aria-label={`คิว ${queueNumber}`}>
                  #{queueNumber}
                </div>
              ) : (
                <div className="mt-8 font-mono text-[clamp(3rem,12vw,5.5rem)] font-black leading-none tracking-tighter text-[#32111c]" aria-label={`รับสินค้าเวลา ${formatTime(order.pickup_at)}`}>
                  {formatTime(order.pickup_at)}
                </div>
              )}
              <Badge className={`mt-8 px-4 py-2 text-xs uppercase tracking-widest font-bold ${view.badge}`}>
                {view.title}
              </Badge>
              <p className="mx-auto mt-6 max-w-md text-sm font-bold leading-relaxed uppercase tracking-wider text-[#4a1424]">{view.description}</p>
            </motion.div>
          </AnimatePresence>
        </Card>
      </motion.section>

      {status === "PENDING_PAYMENT" && (
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button className="h-12" onClick={continuePayment} disabled={!ownsCheckout || createOrder.isPending}>
            {createOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            CONTINUE PAYMENT
          </Button>
          <Button variant="outline" className="h-12" onClick={cancel} disabled={cancelOrder.isPending}>
            {cancelOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} CANCEL ORDER
          </Button>
          <p className="text-center text-[10px] uppercase tracking-widest text-black/50 sm:col-span-2">
            STOCK HELD UNTIL {formatTime(order.reservation_expires_at)} N.
          </p>
        </section>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4 border border-black/10 bg-white p-6">
          <div className="flex h-12 w-12 items-center justify-center border border-black bg-stone-50">
            <Clock3 className="h-5 w-5 text-black" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/60">PICKUP TIME</p>
            <p className="font-mono text-base font-bold text-black">{status === "COMPLETED" ? "COMPLETED" : ready ? "READY NOW" : `${formatTime(order.pickup_at)} N.`}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 border border-black/10 bg-white p-6">
          <div className="flex h-12 w-12 items-center justify-center border border-black bg-stone-50">
            <ReceiptText className="h-5 w-5 text-black" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/60">ORDER TOTAL</p>
            <p className="font-mono text-base font-bold text-black">{formatMinor(order.total_amount_minor)}</p>
          </div>
        </Card>
      </section>

      <Card className="mt-4 border border-black/10 bg-white p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-black/60">ITEMS</p>
        <ul className="mt-3 space-y-2">
          {order.items.map((item) => (
            <li key={item.flavor_id} className="flex justify-between gap-3 text-xs uppercase tracking-wide">
              <span className="font-bold text-black">{item.flavor_name} × {item.portions}</span>
              <span className="font-mono text-black">{formatMinor(item.subtotal_minor)}</span>
            </li>
          ))}
        </ul>
      </Card>

      {(status === "COMPLETED" || status === "CANCELLED") && (
        <Button asChild className="mt-8 h-12 w-full">
          <Link href="/">ORDER AGAIN</Link>
        </Button>
      )}
    </main>
  );
}
