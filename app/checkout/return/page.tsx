"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/store/useCartStore";

// Payment's Stripe success/cancel URLs are fixed per deployment and carry no order ID,
// so the pending order is recovered from the cart. A success redirect is not proof of
// payment; the order page polls Order for the real status.
export default function CheckoutReturnPage() {
  const router = useRouter();
  const orderId = useCartStore((state) => state.checkout?.orderId);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("cancelled")) {
      toast.info("ยกเลิกการชำระเงินแล้ว", { description: "สต็อกยังถูกจองไว้ชั่วคราว ชำระต่อหรือยกเลิกคำสั่งซื้อได้" });
    }
    router.replace(orderId ? `/queue/${orderId}` : "/");
  }, [orderId, router]);

  return (
    <main className="grid min-h-[70vh] place-items-center">
      <Loader2 className="h-8 w-8 animate-spin text-black" />
    </main>
  );
}
