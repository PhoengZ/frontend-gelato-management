"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FlavorCard } from "@/components/FlavorCard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalog, useFulfillmentTicket, useOrder } from "@/lib/api";
import { deriveOrderStatus, isFinalStatus, isPaidOrLater } from "@/lib/order-status";
import { cn, formatMinor } from "@/lib/utils";
import strawberryHero from "@/public/hero/2.png";
import { useCartStore } from "@/store/useCartStore";
import type { MenuFlavor } from "@/types";

const filters: Array<{ key: string; label: string; match: (flavor: MenuFlavor) => boolean }> = [
  { key: "all", label: "ทั้งหมด", match: () => true },
  { key: "available", label: "พร้อมขาย", match: (flavor) => flavor.active && flavor.available_portions > 0 },
  { key: "nut-free", label: "ไม่มีถั่ว", match: (flavor) => !flavor.allergens.some((a) => a === "PEANUT" || a === "TREE_NUT") },
  { key: "dairy-free", label: "ไม่มีนม", match: (flavor) => !flavor.allergens.includes("MILK") }
];

function StoreStatus() {
  const orderId = useCartStore((state) => state.activeOrderId);
  const clearActiveOrder = useCartStore((state) => state.clearActiveOrder);
  const order = useOrder(orderId ?? "");
  const orderStatus = order.data?.status;
  const ticket = useFulfillmentTicket(orderId ?? "", Boolean(orderStatus && isPaidOrLater(orderStatus) && !isFinalStatus(orderStatus)));
  const finished = orderStatus && isFinalStatus(deriveOrderStatus(orderStatus, ticket.data?.status, false));
  const gone = (order.error as { status?: number } | null | undefined)?.status === 404;

  // The customer may pick up without reopening the queue page, so the link settles itself here.
  useEffect(() => {
    if (orderId && (finished || gone)) clearActiveOrder(orderId);
  }, [orderId, finished, gone, clearActiveOrder]);

  const content = (
    <>
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{orderId ? "ติดตามคำสั่งซื้อล่าสุดของคุณ" : "เปิดรับออเดอร์อยู่ตอนนี้"}</span>
        <span className="block text-xs text-subtle">{orderId ? "ดูเวลารับและหมายเลขคิว" : "สั่งล่วงหน้า แล้วมารับตามเวลาที่เลือก"}</span>
      </span>
      {orderId && <ChevronRight className="h-[18px] w-[18px] text-subtle" />}
    </>
  );
  const className = "flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5";
  return orderId ? <Link href={`/queue/${orderId}`} className={cn(className, "hover:border-ink/25")}>{content}</Link> : <div className={className}>{content}</div>;
}

export default function MenuPage() {
  const catalog = useCatalog();
  const items = useCartStore((state) => state.items);
  const [filter, setFilter] = useState("all");
  const itemCount = items.reduce((total, item) => total + item.portions, 0);
  const total = items.reduce((sum, item) => sum + item.portions * item.unitPriceMinor, 0);
  const active = filters.find((entry) => entry.key === filter) ?? filters[0];
  const flavors = catalog.data?.filter(active.match) ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-2">
      <section className="bg-brand-gradient relative isolate overflow-hidden rounded-3xl px-6 pb-6 pt-7 sm:px-10 sm:pt-10" aria-labelledby="hero-heading">
        <div className="pointer-events-none absolute -bottom-6 -right-8 z-0 h-[230px] w-[230px] sm:-bottom-10 sm:right-4 sm:h-[320px] sm:w-[320px]" aria-hidden="true">
          <Image src={strawberryHero} alt="" fill sizes="(max-width: 640px) 230px, 320px" className="object-contain" priority />
        </div>
        <div className="relative z-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Handcrafted daily · Bangkok</p>
          <h1 id="hero-heading" className="mt-3 text-[40px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-6xl">
            Have fun
            <br />
            with gelato.
          </h1>
          <p className="mt-3 max-w-[16rem] text-[15px] leading-relaxed text-ink/75 sm:max-w-sm">เจลาโตทำสดใหม่ทุกวัน สั่งง่าย รับตามคิวแบบเรียลไทม์</p>
          <Link href="#menu" className={cn(buttonVariants(), "mt-24 gap-3 pl-6 pr-5 sm:mt-16")}>
            เลือกรสชาติ <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </section>

      <div className="mt-7">
        <StoreStatus />
      </div>

      <section id="menu" className="mt-7 scroll-mt-20" aria-labelledby="menu-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="menu-heading" className="text-[22px] font-semibold">เมนูวันนี้</h2>
          {catalog.data && <span className="text-xs text-subtle">{flavors.length} รสชาติ</span>}
        </div>

        {!catalog.isError && (
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="กรองเมนู">
            {filters.map((entry) => (
              <Chip key={entry.key} active={entry.key === filter} onClick={() => setFilter(entry.key)}>
                {entry.label}
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-4">
          {catalog.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2" aria-label="กำลังโหลดเมนู">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3.5 rounded-3xl border border-line bg-white p-3">
                  <Skeleton className="h-[104px] w-[104px] shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <Skeleton className="h-3 w-28 rounded-full" />
                    <Skeleton className="h-3 w-full rounded-full" />
                    <Skeleton className="h-3 w-32 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : catalog.isError ? (
            <section className="flex flex-col items-center rounded-3xl border border-line bg-white px-6 py-8 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-pink-soft">
                <WifiOff className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <h3 className="mt-3 text-[17px] font-semibold">โหลดเมนูไม่สำเร็จ</h3>
              <p className="mt-1 text-[13px] text-subtle">กรุณาตรวจสอบการเชื่อมต่อ แล้วลองใหม่อีกครั้ง</p>
              <Button variant="outline" size="sm" className="mt-4 h-11 w-40" onClick={() => void catalog.refetch()}>
                ลองใหม่
              </Button>
            </section>
          ) : flavors.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {flavors.map((flavor) => <FlavorCard key={flavor.id} flavor={flavor} />)}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-line py-10 text-center text-sm text-subtle">ไม่มีเมนูที่ตรงกับตัวกรองนี้</p>
          )}
        </div>
      </section>

      <footer className="mt-12 text-center text-xs text-subtle">© Gelatte · Artisanal gelato, Bangkok</footer>

      <AnimatePresence>
        {itemCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-[24rem] sm:max-w-md"
          >
            <Link href="/cart" className="flex h-[60px] items-center justify-between rounded-full bg-ink pl-2.5 pr-5 text-canvas shadow-float transition-transform active:scale-[0.99]">
              <span className="flex items-center gap-3 text-sm font-medium">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-pink text-sm font-bold text-ink">{itemCount}</span>
                ตะกร้าของฉัน
              </span>
              <span className="flex items-center gap-2.5 text-[17px] font-semibold tabular-nums">
                {formatMinor(total)}
                <ArrowRight className="h-[18px] w-[18px]" />
              </span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
