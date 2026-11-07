"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock3, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiClientError, cancelOrder, fetchOrder, useCatalog, useCreateOrder, useSession } from "@/lib/api";
import { isFinalStatus } from "@/lib/order-status";
import { cn, flavorTint, formatMinor, formatTime, isSameBangkokDay, pickupSlots } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Stepper } from "@/components/ui/stepper";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import vanillaGelato from "@/public/hero/3.png";
import emptyBag from "@/public/illustrations/empty-bag.png";
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

const stockConflictCodes = ["DEPENDENCY_CONFLICT", "FLAVOR_INACTIVE", "INSUFFICIENT_STOCK"];

function CartPromo() {
  return (
    <section className="flex items-center gap-2 rounded-3xl bg-pink-soft py-2 pl-5 pr-2" aria-label="Gelatte promotion">
      <div className="flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pink-strong">Little treat, big smile</p>
        <p className="mt-1 text-[17px] font-semibold leading-snug">เติมความสุขอีกหนึ่งสกู๊ป<br />ในทุกออเดอร์</p>
      </div>
      <Image src={vanillaGelato} alt="Vanilla gelato" className="h-[88px] w-[88px] object-contain" />
    </section>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "text-sm font-medium" : "text-[15px] text-subtle"}>{label}</span>
      <span className={strong ? "text-[22px] font-semibold tabular-nums" : "text-[15px] tabular-nums"}>{value}</span>
    </div>
  );
}

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const updatePortion = useCartStore((state) => state.updatePortion);
  const removeItem = useCartStore((state) => state.removeItem);
  const beginCheckout = useCartStore((state) => state.beginCheckout);
  const attachOrder = useCartStore((state) => state.attachOrder);
  const clearCart = useCartStore((state) => state.clearCart);
  const discardCheckout = useCartStore((state) => state.discardCheckout);
  const setActiveOrder = useCartStore((state) => state.setActiveOrder);
  const settleOrder = useCartStore((state) => state.settleOrder);
  const unsettledOrderId = useCartStore((state) => state.unsettledOrderId);
  const clearActiveOrder = useCartStore((state) => state.clearActiveOrder);
  const pendingCheckout = useCartStore((state) => state.checkout);
  const catalog = useCatalog();
  const createOrder = useCreateOrder();
  const session = useSession();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [pickupAt, setPickupAt] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [checkingPriorOrder, setCheckingPriorOrder] = useState(false);
  const busy = createOrder.isPending || checkingPriorOrder;
  const total = items.reduce((sum, item) => sum + item.portions * item.unitPriceMinor, 0);
  const scoops = items.reduce((sum, item) => sum + item.portions, 0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const openCheckout = () => {
    if (session.isLoading) return;
    if (session.data?.role !== "CUSTOMER") {
      if (session.isError && session.error instanceof ApiClientError && session.error.status !== 401) {
        toast.error("ตรวจสอบบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      toast.error(session.data ? "กรุณาใช้บัญชีลูกค้าเพื่อสั่งสินค้า" : "กรุณาเข้าสู่ระบบก่อนชำระเงิน");
      router.push("/login?next=/cart");
      return;
    }
    const nextSlots = pickupSlots();
    // Keep a still-valid pickup time from an earlier attempt so a retry replays the same order.
    const previous = pendingCheckout?.order.pickup_at;
    const now = new Date();
    const keepPrevious = previous && new Date(previous) > now && isSameBangkokDay(new Date(previous), now);
    setSlots(keepPrevious && !nextSlots.includes(previous) ? [previous, ...nextSlots] : nextSlots);
    setPickupAt((keepPrevious ? previous : nextSlots[0]) ?? "");
    setCheckoutOpen(true);
  };

  /**
   * A customer who paid and closed the Stripe tab never reached the queue page, and may have
   * edited the cart since. Returns true when checkout may proceed. An order that cannot be checked
   * or cancelled blocks checkout, since a new order could charge the customer twice.
   */
  const settlePriorOrder = async (orderId: string) => {
    const sameCheckout = pendingCheckout?.orderId === orderId;
    const forget = () => {
      settleOrder(orderId);
      if (sameCheckout) discardCheckout();
    };
    setCheckingPriorOrder(true);
    try {
      const prior = await fetchOrder(orderId);
      if (prior.status === "CANCELLED" || prior.status === "CANCEL_PENDING") {
        forget();
        return true;
      }
      if (prior.status === "PENDING_PAYMENT") {
        if (sameCheckout && pendingCheckout.order.pickup_at === pickupAt) return true;
        // Its Stripe session may still be open. A late payment on it is rejected and refunded.
        await cancelOrder(orderId);
        forget();
        return true;
      }
      if (prior.status === "PAYMENT_CONFIRMING") setActiveOrder(orderId);
      else {
        // An edited cart is a new intent, so it stays for the customer to review.
        if (sameCheckout) clearCart();
        settleOrder(orderId);
        if (isFinalStatus(prior.status)) clearActiveOrder(orderId);
        else setActiveOrder(orderId);
      }
      toast.info("คำสั่งซื้อก่อนหน้าชำระเงินแล้ว ไม่ต้องชำระซ้ำ");
      router.push(`/queue/${orderId}`);
      return false;
    } catch (error) {
      const status = error instanceof ApiClientError ? error.status : 0;
      if (status === 404) {
        forget();
        return true;
      }
      if (status === 401) {
        toast.error("กรุณาเข้าสู่ระบบก่อนชำระเงิน");
        router.push("/login?next=/cart");
        return false;
      }
      toast.error("ตรวจสอบคำสั่งซื้อก่อนหน้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      return false;
    } finally {
      setCheckingPriorOrder(false);
    }
  };

  const pay = async () => {
    if (!items.length || !pickupAt || busy) return;
    const priorOrderId = unsettledOrderId ?? pendingCheckout?.orderId;
    if (priorOrderId && !(await settlePriorOrder(priorOrderId))) return;
    const checkout = beginCheckout(pickupAt);
    createOrder.mutate(
      { order: checkout.order, idempotencyKey: checkout.idempotencyKey },
      {
        onSuccess: (order) => {
          attachOrder(order.order_id);
          if (order.checkout_url) {
            setRedirecting(true);
            window.location.assign(order.checkout_url);
            return;
          }
          // A replay of an order that is no longer payable returns its state without a URL.
          router.push(`/queue/${order.order_id}`);
        },
        onError: (error) => {
          if (error instanceof ApiClientError && error.status === 401) {
            toast.error("กรุณาเข้าสู่ระบบก่อนชำระเงิน");
            router.push("/login?next=/cart");
            return;
          }
          if (error instanceof ApiClientError && error.code === "RESERVATION_EXPIRED") {
            // This key can never succeed again; dropping it gives the next attempt a new one.
            discardCheckout();
            toast.error(error.message);
            return;
          }
          if (error instanceof ApiClientError && error.code === "PICKUP_NOT_SAME_DAY") {
            // Reopening the sheet offers the new day's slots.
            setCheckoutOpen(false);
            toast.error(error.message);
            return;
          }
          if (error instanceof ApiClientError && stockConflictCodes.includes(error.code)) {
            setCheckoutOpen(false);
            setStockError(error.message);
            void catalog.refetch();
            return;
          }
          if (error instanceof ApiClientError && error.status >= 502) {
            toast.error(error.message, { description: "ระบบเก็บคำสั่งซื้อเดิมไว้แล้ว กดชำระเงินอีกครั้งได้อย่างปลอดภัย" });
            return;
          }
          toast.error(error instanceof Error ? error.message : "สร้างคำสั่งซื้อไม่สำเร็จ");
        }
      }
    );
  };

  if (redirecting) {
    return (
      <main className="mx-auto grid min-h-[calc(100svh-60px)] max-w-md place-items-center px-8 text-center">
        <div>
          <span className="mx-auto grid h-[88px] w-[88px] place-items-center rounded-full bg-pink-soft">
            <Loader2 className="h-10 w-10 animate-spin text-pink-strong" />
          </span>
          <h1 className="mt-4 text-[22px] font-semibold">กำลังพาไปหน้าชำระเงิน</h1>
          <p className="mt-2 text-[15px] text-subtle">เราจองสต็อกไว้ให้แล้ว<br />กรุณาอย่าปิดหน้านี้</p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-xs text-subtle">
            <Lock className="h-3.5 w-3.5" /> Stripe · PromptPay
          </span>
        </div>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-60px)] max-w-md flex-col items-center justify-center px-8 pb-20 text-center">
        <Image src={emptyBag} alt="" className="h-[200px] w-[200px] rounded-3xl object-cover" priority />
        <h1 className="mt-3 text-[22px] font-semibold">ตะกร้ายังว่างอยู่</h1>
        <p className="mt-2 text-[15px] text-subtle">ยังไม่มีเจลาโตในตะกร้าของคุณ<br />เลือกรสที่ชอบได้เลย</p>
        <Link href="/" className={cn(buttonVariants({ size: "lg" }), "mt-6 w-56")}>ดูเมนูวันนี้</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-36 pt-2">
      <CartPromo />

      <ul className="mt-4 space-y-2.5" aria-label="รายการในตะกร้า">
        {items.map((item) => {
          const flavor = catalog.data?.find((entry) => entry.id === item.flavorId);
          const atLimit = flavor ? item.portions >= flavor.available_portions : false;
          return (
            <li key={item.flavorId} className="relative flex items-center gap-3.5 rounded-3xl border border-line bg-white p-3">
              <div className={cn("relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl", flavorTint(item.flavorName))}>
                <Image src={flavor?.image_url ?? "/hero/3.png"} alt="" fill sizes="72px" className="object-contain" unoptimized={Boolean(flavor?.image_url)} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate pr-8 text-[17px] font-semibold">{item.flavorName}</h2>
                <p className="text-xs text-subtle">{formatMinor(item.unitPriceMinor)} / สกู๊ป</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Stepper
                    value={item.portions}
                    label={item.flavorName}
                    onDecrement={() => updatePortion(item.flavorId, item.portions - 1)}
                    onIncrement={() => updatePortion(item.flavorId, item.portions + 1)}
                    incrementDisabled={atLimit}
                  />
                  <span className="text-[17px] font-semibold tabular-nums">{formatMinor(item.unitPriceMinor * item.portions)}</span>
                </div>
              </div>
              <button
                type="button"
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-subtle hover:bg-ink/5 hover:text-ink"
                onClick={() => removeItem(item.flavorId)}
                aria-label={`ลบ ${item.flavorName}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>

      <Link href="/" className="mt-2.5 flex items-center justify-center gap-2 rounded-3xl border border-dashed border-line py-3.5 text-sm font-medium hover:border-ink/30">
        <Plus className="h-[18px] w-[18px]" /> เพิ่มรสชาติอื่น
      </Link>

      <section className="mt-4 space-y-2.5 rounded-3xl border border-line bg-white p-4" aria-label="สรุปคำสั่งซื้อ">
        <SummaryRow label="จำนวนสกู๊ป" value={`${scoops} สกู๊ป`} />
        <SummaryRow label="รับสินค้า" value="เลือกเวลาตอนชำระเงิน" />
        <hr className="border-line" />
        <SummaryRow label="ยอดรวม" value={formatMinor(total)} strong />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-safe pt-4">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4">
          <div>
            <p className="text-xs text-subtle">ยอดรวม · {scoops} สกู๊ป</p>
            <p className="text-[22px] font-bold tabular-nums leading-tight">{formatMinor(total)}</p>
          </div>
          <Button size="lg" className="flex-1" onClick={openCheckout} disabled={session.isLoading}>
            {session.isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> กำลังตรวจสอบบัญชี…</> : "ไปชำระเงิน"}
          </Button>
        </div>
      </div>

      <Sheet open={checkoutOpen} onOpenChange={(open) => !busy && setCheckoutOpen(open)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>ชำระเงิน</SheetTitle>
            <SheetDescription>Stripe Checkout · PromptPay</SheetDescription>
          </SheetHeader>

          <fieldset disabled={busy}>
            <legend className="flex items-center gap-1.5 text-sm font-medium">
              <Clock3 className="h-4 w-4 text-subtle" /> เลือกเวลารับสินค้า
            </legend>
            <div className="mt-2.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="เวลารับสินค้า">
              {slots.map((slot) => (
                <Chip key={slot} role="radio" aria-checked={slot === pickupAt} active={slot === pickupAt} className="h-10 px-0" onClick={() => setPickupAt(slot)}>
                  {formatTime(slot)} น.
                </Chip>
              ))}
            </div>
            {!slots.length && (
              <p role="alert" className="mt-2.5 rounded-2xl bg-pink-soft px-4 py-3 text-sm">
                วันนี้ไม่มีรอบรับสินค้าเหลือแล้ว รับสินค้าได้เฉพาะภายในวันที่สั่งเท่านั้น กรุณาสั่งใหม่อีกครั้งพรุ่งนี้
              </p>
            )}
          </fieldset>

          <div className="mt-4 space-y-2 rounded-3xl border border-line bg-white p-4">
            {items.map((item) => (
              <SummaryRow key={item.flavorId} label={`${item.flavorName} × ${item.portions}`} value={formatMinor(item.unitPriceMinor * item.portions)} />
            ))}
            <hr className="border-line" />
            <SummaryRow label="ยอดชำระโดยประมาณ" value={formatMinor(total)} strong />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-subtle">ราคาสุดท้ายคำนวณจากราคาเมนูล่าสุด และจองสต็อกไว้ให้ระหว่างชำระเงิน</p>

          <Button size="lg" className="mt-4 w-full" onClick={() => void pay()} disabled={!pickupAt || busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> กำลังจองสกู๊ปให้คุณ…</> : `ชำระเงิน ${formatMinor(total)}`}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-subtle">
            <Lock className="h-3.5 w-3.5" /> ปลอดภัยด้วย Stripe · ป้องกันการชำระซ้ำ
          </p>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(stockError)} onOpenChange={(open) => !open && setStockError(null)}>
        <AlertDialogContent>
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-pink-soft">
            <AlertTriangle className="h-6 w-6 text-pink-strong" />
          </span>
          <AlertDialogHeader>
            <AlertDialogTitle>สต็อกมีการเปลี่ยนแปลง</AlertDialogTitle>
            <AlertDialogDescription>{stockError} เราอัปเดตจำนวนล่าสุดให้แล้ว กรุณาปรับตะกร้าอีกครั้ง</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setStockError(null)}>ปรับตะกร้า</AlertDialogAction>
            <AlertDialogCancel onClick={() => { setStockError(null); router.push("/"); }}>กลับไปดูเมนู</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
