"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellOff, BellRing, Check, Clock3, CreditCard, Loader2, ReceiptText, RefreshCw, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { errorStatus, StaleNotice, useLoginOnUnauthorized } from "@/components/StaleNotice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useCancelOrder, useCreateOrder, useFulfillmentTicket, useOrder } from "@/lib/api";
import { deriveOrderStatus, isFinalStatus, isPaidOrLater } from "@/lib/order-status";
import { cn, formatMinor, formatTime } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";
import { useReadyNotification } from "@/store/useNotificationStore";
import type { OrderStatus } from "@/types";
import cookieMascot from "@/public/cookie-mascot.png";
import chefScoop from "@/public/illustrations/chef-scoop.png";
import readyCone from "@/public/illustrations/ready-cone.png";

interface StatusView {
  title: string;
  description: string;
  tone: NonNullable<BadgeProps["tone"]>;
  icon: LucideIcon;
  /** Index into `steps`; -1 hides the progress bar. */
  step: number;
  image?: StaticImageData;
}

const steps = ["ชำระเงิน", "กำลังเตรียม", "พร้อมรับ", "รับแล้ว"];

const statusView: Record<OrderStatus, StatusView> = {
  PENDING_PAYMENT: { title: "รอชำระเงิน", description: "จองสต็อกไว้ให้แล้ว กรุณาชำระเงินให้เสร็จก่อนหมดเวลาจอง", tone: "neutral", icon: CreditCard, step: 0 },
  PAYMENT_CONFIRMING: { title: "กำลังยืนยันการชำระ", description: "ได้รับผลการชำระเงินแล้ว กำลังยืนยันสต็อก…", tone: "neutral", icon: Loader2, step: 0 },
  CANCEL_PENDING: { title: "กำลังยกเลิก", description: "กำลังยกเลิกคำสั่งซื้อและคืนสต็อก…", tone: "neutral", icon: Loader2, step: -1 },
  PAID: { title: "ชำระเงินแล้ว", description: "รับออเดอร์แล้ว กำลังส่งเข้าคิวเตรียมเจลาโต", tone: "soft", icon: ReceiptText, step: 1 },
  PREPARING: { title: "กำลังเตรียม", description: "เชฟกำลังตั้งใจตักเจลาโตสดใหม่สำหรับคุณ", tone: "ink", icon: Loader2, step: 1, image: chefScoop },
  READY_FOR_PICKUP: { title: "พร้อมรับแล้ว", description: "เจลาโตของคุณพร้อมแล้ว! แสดงหน้าจอนี้แก่พนักงานที่เคาน์เตอร์", tone: "ink", icon: BellRing, step: 2, image: readyCone },
  COMPLETED: { title: "รับสินค้าแล้ว", description: "ขอให้มีความสุขกับเจลาโตนะ แล้วพบกันใหม่!", tone: "success", icon: Check, step: 3 },
  CANCELLED: { title: "ยกเลิกแล้ว", description: "คำสั่งซื้อนี้ถูกยกเลิกและคืนสต็อกเรียบร้อยแล้ว", tone: "neutral", icon: X, step: -1 }
};

/** How long a return from Stripe waits for the webhook before offering Pay and Cancel again. */
const PAYMENT_CONFIRMATION_WINDOW_MS = 60_000;

const paymentConfirmationView: StatusView = {
  ...statusView.PAYMENT_CONFIRMING,
  title: "กำลังยืนยันการชำระเงิน",
  description: "เรากำลังรอผลจาก Stripe ไม่ต้องชำระซ้ำ หน้านี้จะอัปเดตให้อัตโนมัติ"
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

function InfoTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-line bg-white p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas"><Icon className="h-[18px] w-[18px]" strokeWidth={1.75} /></span>
      <div className="min-w-0">
        <p className="text-xs text-subtle">{label}</p>
        <p className="truncate text-[17px] font-semibold">{value}</p>
      </div>
    </div>
  );
}

function confirmationTimeLeft(returnedAt: number | undefined) {
  if (returnedAt === undefined) return 0;
  const elapsed = Date.now() - returnedAt;
  return elapsed >= 0 && elapsed < PAYMENT_CONFIRMATION_WINDOW_MS ? PAYMENT_CONFIRMATION_WINDOW_MS - elapsed : 0;
}

export function QueueTracker({ orderId, returnedAt }: { orderId: string; returnedAt?: number }) {
  const [awaitingWebhook, setAwaitingWebhook] = useState(() => confirmationTimeLeft(returnedAt) > 0);
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const query = useOrder(orderId, { fastPoll: awaitingWebhook });
  const order = query.data;
  const ticketQuery = useFulfillmentTicket(orderId, Boolean(order && isPaidOrLater(order.status) && !isFinalStatus(order.status)));
  const ticket = ticketQuery.data;
  const readyNotification = useReadyNotification(orderId);
  const cancelOrder = useCancelOrder();
  const createOrder = useCreateOrder();
  const checkout = useCartStore((state) => state.checkout);
  const clearCart = useCartStore((state) => state.clearCart);
  const discardCheckout = useCartStore((state) => state.discardCheckout);
  const setActiveOrder = useCartStore((state) => state.setActiveOrder);
  const clearActiveOrder = useCartStore((state) => state.clearActiveOrder);
  const settleOrder = useCartStore((state) => state.settleOrder);
  const reduceMotion = useReducedMotion();
  const wasReady = useRef<boolean | undefined>(undefined);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const redirectingToLogin = useLoginOnUnauthorized(query.error);
  const notFound = !order && errorStatus(query.error) === 404;
  const status: OrderStatus | undefined = order && deriveOrderStatus(order.status, ticket?.status, Boolean(readyNotification));
  const ready = status === "READY_FOR_PICKUP";
  const queueNumber = ticket?.queue_number ?? readyNotification?.data.queue_number;
  const ownsCheckout = checkout?.orderId === orderId;
  const holdExpiresAt = order ? Date.parse(order.reservation_expires_at) : NaN;
  const holdExpired = holdExpiresAt <= now;
  const confirmingPayment = awaitingWebhook && status === "PENDING_PAYMENT";

  useEffect(() => {
    const timeLeft = confirmationTimeLeft(returnedAt);
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => setAwaitingWebhook(false), timeLeft);
    return () => clearTimeout(timer);
  }, [returnedAt]);

  useEffect(() => {
    if (!Number.isFinite(holdExpiresAt)) return;
    const timeLeft = holdExpiresAt - Date.now();
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), timeLeft);
    return () => clearTimeout(timer);
  }, [holdExpiresAt]);

  useEffect(() => {
    if (ready && wasReady.current === false && soundEnabled) playReadyTone();
    if (status) wasReady.current = ready;
  }, [ready, status, soundEnabled]);

  useEffect(() => {
    if (!ownsCheckout || !order) return;
    if (order.status === "CANCELLED") discardCheckout();
    else if (isPaidOrLater(order.status)) {
      clearCart();
      setActiveOrder(orderId);
    }
  }, [ownsCheckout, order, orderId, clearCart, discardCheckout, setActiveOrder]);

  useEffect(() => {
    if (order && (order.status === "CANCELLED" || isPaidOrLater(order.status))) settleOrder(orderId);
  }, [order, orderId, settleOrder]);

  useEffect(() => {
    if (notFound || (status && isFinalStatus(status))) clearActiveOrder(orderId);
  }, [notFound, status, orderId, clearActiveOrder]);

  const continuePayment = () => {
    if (!checkout) return;
    createOrder.mutate(
      { order: checkout.order, idempotencyKey: checkout.idempotencyKey },
      {
        onSuccess: (replay) => {
          if (replay.checkout_url) window.location.assign(replay.checkout_url);
          else void query.refetch();
        },
        onError: (error) => {
          // The same key can never succeed again; the cart starts a new order with a new one.
          if ((error as { code?: string }).code === "RESERVATION_EXPIRED") discardCheckout();
          toast.error(error.message);
        }
      }
    );
  };

  const cancel = () => {
    cancelOrder.mutate(orderId, {
      onSuccess: () => toast.success("ยกเลิกคำสั่งซื้อแล้ว"),
      onError: (error) => toast.error(error.message)
    });
  };

  if (query.isLoading || redirectingToLogin) {
    return (
      <main className="grid min-h-[75svh] place-items-center">
        <div className="text-center">
          <span className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-pink-soft">
            <Loader2 className="h-8 w-8 animate-spin text-pink-strong" />
          </span>
          <p className="mt-4 text-sm text-subtle">กำลังโหลดคำสั่งซื้อ…</p>
        </div>
      </main>
    );
  }

  if (!order || !status) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-60px)] max-w-md flex-col items-center justify-center px-8 pb-20 text-center">
        <span className="relative h-40 w-40 overflow-hidden rounded-full bg-pink-soft">
          <Image src={cookieMascot} alt="" fill sizes="160px" className="object-contain" />
        </span>
        {notFound ? (
          <>
            <h1 className="mt-3 text-[22px] font-semibold">ไม่พบคำสั่งซื้อนี้</h1>
            <p className="mt-2 text-[15px] text-subtle">คำสั่งซื้อนี้ไม่อยู่ในบัญชีของคุณ<br />หรืออาจถูกลบไปแล้ว</p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-[22px] font-semibold">ระบบขัดข้องชั่วคราว</h1>
            <p className="mt-2 text-[15px] text-subtle">คำสั่งซื้อของคุณไม่ได้หายไปไหน<br />กรุณาลองใหม่อีกครั้งในอีกสักครู่</p>
          </>
        )}
        <div className="mt-6 flex gap-2.5">
          <Button variant="outline" onClick={() => void query.refetch()}>
            <RefreshCw className="h-4 w-4" /> ลองใหม่
          </Button>
          <Link href="/" className={buttonVariants()}>กลับหน้าแรก</Link>
        </div>
      </main>
    );
  }

  const view = confirmingPayment ? paymentConfirmationView : statusView[status];
  const Icon = view.icon;
  const spinning = confirmingPayment || status === "PAYMENT_CONFIRMING" || status === "CANCEL_PENDING";
  const cancelled = status === "CANCELLED";

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 pb-16 pt-1">
      {query.isError && <StaleNotice />}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-subtle">สั่งเมื่อ {formatTime(order.created_at)} น. · #{order.order_id.slice(0, 8).toUpperCase()}</p>
        <button
          type="button"
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            if (next) playReadyTone();
          }}
          aria-pressed={soundEnabled}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
            soundEnabled ? "bg-ink text-canvas" : "border border-line bg-white"
          )}
        >
          {soundEnabled ? <BellRing className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          {soundEnabled ? "เสียงเปิดอยู่" : "เปิดเสียงแจ้งเตือน"}
        </button>
      </div>

      <motion.section
        animate={ready && !reduceMotion ? { scale: [1, 1.01, 1] } : undefined}
        transition={ready && !reduceMotion ? { repeat: Infinity, duration: 1.8 } : undefined}
        className={cn(
          "overflow-hidden rounded-3xl text-center",
          ready ? "bg-brand-gradient" : cancelled ? "bg-line" : "bg-pink-soft"
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {status === "PREPARING" && view.image ? (
              <Image src={view.image} alt="เชฟกำลังตักเจลาโต" className="h-[170px] w-full object-cover" priority />
            ) : view.image ? (
              <Image src={view.image} alt="" className="mx-auto mt-7 h-[180px] w-[180px] rounded-full object-cover shadow-float" priority />
            ) : (
              <span className="mx-auto mt-8 grid h-14 w-14 place-items-center rounded-full bg-white">
                <Icon className={cn("h-6 w-6", spinning && "animate-spin")} />
              </span>
            )}

            <div className="space-y-2 px-6 pb-7 pt-3">
              {queueNumber ? (
                <>
                  <p className="text-xs">หมายเลขคิวของคุณ</p>
                  <p className="text-[84px] font-bold leading-none tracking-[-0.04em]" aria-label={`คิว ${queueNumber}`}>#{queueNumber}</p>
                </>
              ) : (
                <>
                  <p className={cn("text-xs", cancelled && "text-subtle")}>เวลารับสินค้า</p>
                  <p
                    className={cn("text-[64px] font-bold leading-none tracking-[-0.04em]", cancelled && "text-subtle line-through")}
                    aria-label={`รับสินค้าเวลา ${formatTime(order.pickup_at)}`}
                  >
                    {formatTime(order.pickup_at)}
                  </p>
                </>
              )}
              <Badge tone={view.tone} pulse={ready}>{view.title}</Badge>
              <p className="mx-auto max-w-xs text-[15px] leading-relaxed text-ink/75">{view.description}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.section>

      {view.step >= 0 && (
        <ol className="grid grid-cols-4 gap-1.5" aria-label="ความคืบหน้าคำสั่งซื้อ">
          {steps.map((label, index) => {
            const done = index <= view.step;
            const current = index === view.step;
            return (
              <li key={label} className="space-y-1.5" aria-current={current ? "step" : undefined}>
                <span className={cn("block h-1 rounded-full", done ? (current && index < 3 ? "bg-pink" : "bg-ink") : "bg-line")} />
                <span className={cn("block text-xs", done ? "text-ink" : "text-subtle", current && "font-semibold")}>{label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {status === "PENDING_PAYMENT" && !confirmingPayment && (
        <section className="space-y-2.5">
          <Button size="lg" className="w-full" onClick={continuePayment} disabled={!ownsCheckout || createOrder.isPending || holdExpired}>
            {createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            ชำระเงินต่อ
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => setCancelPromptOpen(true)} disabled={cancelOrder.isPending}>
            {cancelOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" />} ยกเลิกคำสั่งซื้อ
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-pink-strong">
            <Clock3 className="h-3.5 w-3.5" />
            {holdExpired ? "หมดเวลาจองสต็อกแล้ว กรุณากลับไปที่ตะกร้าเพื่อสั่งใหม่" : `จองสต็อกไว้ถึง ${formatTime(order.reservation_expires_at)} น.`}
          </p>
          <AlertDialog open={cancelPromptOpen} onOpenChange={setCancelPromptOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>ยกเลิกคำสั่งซื้อนี้?</AlertDialogTitle>
                <AlertDialogDescription>หากชำระเงินไปแล้ว กรุณารอการยืนยันสักครู่ก่อนยกเลิก เมื่อยกเลิกแล้วจะคืนสต็อกทันที</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={cancel}>ยืนยันการยกเลิก</AlertDialogAction>
                <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      )}

      <section className="grid grid-cols-2 gap-2.5">
        <InfoTile icon={Clock3} label="เวลารับสินค้า" value={status === "COMPLETED" ? "รับแล้ว" : ready ? "พร้อมรับเลย" : `${formatTime(order.pickup_at)} น.`} />
        <InfoTile icon={ReceiptText} label="ยอดรวม" value={formatMinor(order.total_amount_minor)} />
      </section>

      <section className="rounded-3xl border border-line bg-white p-4">
        <p className="text-xs text-subtle">รายการ</p>
        <ul className="mt-2 space-y-2">
          {order.items.map((item) => (
            <li key={item.flavor_id} className="flex justify-between gap-3 text-[15px]">
              <span>{item.flavor_name} × {item.portions}</span>
              <span className="tabular-nums">{formatMinor(item.subtotal_minor)}</span>
            </li>
          ))}
        </ul>
      </section>

      {(status === "COMPLETED" || cancelled) && (
        <Link href="/" className={cn(buttonVariants({ size: "lg" }), "w-full")}>สั่งอีกครั้ง</Link>
      )}
    </main>
  );
}
