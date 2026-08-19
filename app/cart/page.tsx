"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiClientError, useCatalog, useCreateOrder, useSession } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { StripeCheckoutForm } from "@/components/StripeCheckoutForm";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    "pk_test_51U5QoBK6FQZueCtVt7lbdtxVV0KCu2tVAusxQm8N8BaPlyLCfmMFwaLDgBWis7k93TE56f0Aa1zfw28YxyflKrDz00bW1IGEjt"
);
import vanillaGelato from "@/public/hero/3.png";
import promptpayQr from "@/public/promptpay.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

function CartPromoBanner() {
  return (
    <section className="relative h-24 overflow-hidden border-b border-black/15 bg-[#f79bad] sm:h-28" aria-label="Gelatte promotion">
      <div className="relative z-10 mx-auto flex h-full max-w-3xl items-center px-6 pr-28 sm:px-8 sm:pr-40">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#631c31] sm:text-xs">Little treat, big smile</p>
          <p className="mt-1 text-lg font-semibold text-[#32111c] sm:text-2xl">เติมความสุขอีกหนึ่ง scoop ในทุกออเดอร์</p>
        </div>
      </div>
      <Image
        src={vanillaGelato}
        alt="Vanilla gelato"
        className="pointer-events-none absolute bottom-0 right-4 h-20 w-20 object-contain sm:right-[max(2rem,calc((100vw-48rem)/2))] sm:h-24 sm:w-24"
      />
    </section>
  );
}

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const updatePortion = useCartStore((state) => state.updatePortion);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const beginCheckout = useCartStore((state) => state.beginCheckout);
  const catalog = useCatalog();
  const createOrder = useCreateOrder();
  const session = useSession();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<"STRIPE" | "PROMPTPAY">("STRIPE");
  const total = items.reduce((sum, item) => sum + item.portions * item.unitPrice, 0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const openCheckout = async () => {
    if (session.isLoading) return;
    if (session.data?.user.role !== "CUSTOMER") {
      if (session.isError && session.error instanceof ApiClientError && session.error.status !== 401) {
        toast.error("ตรวจสอบบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      toast.error(session.data ? "กรุณาใช้บัญชี CUSTOMER เพื่อสั่งสินค้า" : "กรุณาเข้าสู่ระบบก่อน Checkout");
      router.push("/login?next=/cart");
      return;
    }
    beginCheckout();
    setCheckoutOpen(true);

    try {
      const res = await fetch("/api/v1/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total })
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      }
    } catch {
      // Fallback
    }
  };

  const pay = () => {
    if (!items.length || createOrder.isPending) return;
    const idempotencyKey = beginCheckout();
    createOrder.mutate(
      {
        items: items.map((item) => ({ flavorId: item.flavorId, portions: item.portions })),
        paymentMethod: "PROMPTPAY_MOCK",
        idempotencyKey
      },
      {
        onSuccess: (order) => {
          clearCart();
          toast.success("ชำระเงินสำเร็จ รับหมายเลขคิวแล้ว");
          router.push(`/queue/${order.orderId}`);
        },
        onError: (error) => {
          if (error instanceof ApiClientError && error.status === 401) {
            toast.error("กรุณาเข้าสู่ระบบ Customer ก่อนชำระเงิน");
            router.push("/login?next=/cart");
            return;
          }
          if (error instanceof ApiClientError && (error.status === 400 || error.code === "OUT_OF_STOCK")) {
            setCheckoutOpen(false);
            setStockError(error.message);
            void catalog.refetch();
            return;
          }
          if (error instanceof ApiClientError && error.status === 409) {
            toast.error(error.message, { description: "ระบบยังเก็บรหัสรายการเดิมไว้เพื่อให้ลองซ้ำได้อย่างปลอดภัย" });
            return;
          }
          toast.error(error instanceof Error ? error.message : "ชำระเงินไม่สำเร็จ");
        }
      }
    );
  };

  if (!items.length) {
    return (
      <main className="font-prompt">
        <CartPromoBanner />
        <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-6 text-center">
          <div className="border border-black bg-white p-12 shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center border border-black bg-stone-50">
              <ShoppingBag className="h-8 w-8 text-black" />
            </div>
            <h1 className="mt-6 text-2xl font-black uppercase tracking-wider text-black">YOUR BAG IS EMPTY</h1>
            <p className="mt-2 text-xs uppercase tracking-widest text-black/60">ยังไม่มีรายการเจลาโต้ในตะกร้าของคุณ</p>
            <Button asChild className="mt-8 px-8 py-4">
              <Link href="/">DISCOVER MENU</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="font-prompt">
      <CartPromoBanner />
      <div className="mx-auto max-w-3xl px-6 pb-28 pt-10 sm:pt-14">
      <Button asChild variant="ghost" className="-ml-3 mb-6">
        <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> CONTINUE SELECTION</Link>
      </Button>
      <div className="border-b border-black pb-6">
        <h1 className="text-4xl font-black uppercase tracking-tight text-black">YOUR SELECTION</h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-black/60">REVIEW ORDER SUMMARY & SCOOPS</p>
      </div>

      <div className="mt-8 space-y-4">
        {items.map((item) => {
          const flavor = catalog.data?.find((entry) => entry.id === item.flavorId);
          const atLimit = flavor ? item.portions >= flavor.availablePortions : false;
          return (
            <Card key={item.flavorId} className="flex items-center gap-6 border border-black/10 bg-white p-5 transition-all hover:border-black">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold uppercase tracking-wide text-black">{item.flavorName}</h2>
                <p className="mt-0.5 font-mono text-xs font-medium text-black/60">{formatPrice(item.unitPrice)} / SCOOP</p>
              </div>
              <div className="flex items-center border border-black/20 bg-white p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updatePortion(item.flavorId, item.portions - 1)} aria-label={`ลดจำนวน ${item.flavorName}`}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-10 text-center font-mono text-xs font-bold">{item.portions}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 disabled:opacity-20" disabled={atLimit} onClick={() => updatePortion(item.flavorId, item.portions + 1)} aria-label={`เพิ่มจำนวน ${item.flavorName}`}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="w-24 text-right font-mono text-base font-bold text-black">{formatPrice(item.unitPrice * item.portions)}</div>
              <Button variant="ghost" size="icon" className="text-black/40" onClick={() => removeItem(item.flavorId)} aria-label={`ลบ ${item.flavorName}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
      </div>

      <section className="mt-10 border border-black bg-black p-8 text-white">
        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/70">
          <span>TOTAL SCOOPS</span>
          <span className="font-mono font-bold text-white">{items.reduce((sum, item) => sum + item.portions, 0)} SCOOPS</span>
        </div>
        <div className="mt-3 flex items-end justify-between border-t border-white/20 pt-4">
          <span className="text-sm uppercase tracking-widest font-bold">TOTAL AMOUNT</span>
          <span className="font-mono text-3xl font-bold">{formatPrice(total)}</span>
        </div>
        <Button size="lg" className="mt-8 h-14 w-full" onClick={openCheckout} disabled={session.isLoading}>
          {session.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
          {session.isLoading ? "CHECKING ACCOUNT..." : "PROCEED TO CHECKOUT"}
        </Button>
      </section>

      <Sheet open={checkoutOpen} onOpenChange={(open) => !createOrder.isPending && setCheckoutOpen(open)}>
        <SheetContent className="font-prompt border-l border-black bg-white p-6 sm:p-8 overflow-y-auto">
          <SheetHeader className="text-left border-b border-black/10 pb-4">
            <SheetTitle className="text-xl font-bold uppercase tracking-wider text-black">CHECKOUT & PAYMENT</SheetTitle>
            <SheetDescription className="text-xs uppercase tracking-widest text-black/60">
              STRIPE INTEGRATED GATEWAY — CARD / PROMPTPAY
            </SheetDescription>
          </SheetHeader>

          {/* Payment Method Tabs */}
          <div className="mt-6 flex border border-black p-1 bg-stone-100">
            <button
              type="button"
              onClick={() => setPaymentMode("STRIPE")}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                paymentMode === "STRIPE" ? "bg-black text-white" : "text-black hover:bg-stone-200"
              }`}
            >
              STRIPE CARD / PAY
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode("PROMPTPAY")}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                paymentMode === "PROMPTPAY" ? "bg-black text-white" : "text-black hover:bg-stone-200"
              }`}
            >
              PROMPTPAY MOCK
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between border border-black/10 bg-stone-50 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-black/70">TOTAL AMOUNT</span>
            <span className="font-mono text-2xl font-black text-black">{formatPrice(total)}</span>
          </div>

          {paymentMode === "STRIPE" ? (
            clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "flat" } }}>
                <StripeCheckoutForm
                  totalAmount={total}
                  onSuccess={pay}
                  isProcessing={createOrder.isPending}
                />
              </Elements>
            ) : (
              <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-black/60">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-black" />
                LOADING STRIPE PAYMENT GATEWAY...
              </div>
            )
          ) : (
            <>
              <div className="mt-6 border border-black bg-white p-6 text-center">
                <div className="mx-auto relative w-full max-w-[240px] aspect-square overflow-hidden border border-black p-2 bg-white shadow-md">
                  <Image
                    src={promptpayQr}
                    alt="PromptPay QR Code"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
              <Button size="lg" className="mt-6 h-14 w-full text-xs font-bold uppercase tracking-wider" onClick={pay} disabled={createOrder.isPending}>
                {createOrder.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> PROCESSING ORDER...</> : <><CreditCard className="mr-2 h-4 w-4" /> CONFIRM PAYMENT</>}
              </Button>
            </>
          )}

          <p className="mt-6 text-center text-[10px] uppercase tracking-widest text-black/50">SECURED BY STRIPE & IDEMPOTENCY PROTECTION</p>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(stockError)} onOpenChange={(open) => !open && setStockError(null)}>
        <AlertDialogContent className="border border-black bg-white p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold uppercase tracking-wider">STOCK OUT OF SYNC</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-black/70">{stockError} เราอัปเดตจำนวนล่าสุดให้แล้ว กรุณากลับไปปรับตะกร้า</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogAction onClick={() => { setStockError(null); router.push("/"); }}>
              RETURN TO CATALOG
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </main>
  );
}
