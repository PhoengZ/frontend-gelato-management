"use client";

import { Check, Clock3, Loader2, RefreshCw, ShoppingBag, BellRing } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Eyebrow, PageHeader, StatTile } from "@/components/backoffice/PageParts";
import { StaleNotice, useLoginOnUnauthorized } from "@/components/StaleNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFulfillments, useUpdateFulfillmentStatus } from "@/lib/api";
import { cn, formatTime } from "@/lib/utils";
import type { Fulfillment, UpdateFulfillmentStatusRequest } from "@/types";

type NextStatus = UpdateFulfillmentStatusRequest["status"];

/** Figma: OrderTicket — Preparing / Ready. */
function OrderTicket({ order, onUpdate, updating }: { order: Fulfillment; onUpdate: (orderId: string, status: NextStatus) => void; updating: boolean }) {
  const isReady = order.status === "READY_FOR_PICKUP";
  const nextStatus: NextStatus = isReady ? "PICKED_UP" : "READY_FOR_PICKUP";
  return (
    <motion.article layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
      <div className={cn("space-y-3.5 rounded-3xl border p-4", isReady ? "border-pink bg-pink-soft" : "border-line bg-white")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-subtle">คิว</p>
            <h3 className="text-[34px] font-bold leading-none tracking-[-0.02em]">#{order.queue_number}</h3>
          </div>
          <Badge tone={isReady ? "ink" : "neutral"}>{isReady ? "พร้อมรับ" : "กำลังเตรียม"}</Badge>
        </div>
        <ul className="space-y-1 text-[15px]">
          {order.items.map((item) => (
            <li key={item.flavor_id} className="flex justify-between gap-3">
              <span>{item.flavor_name}</span>
              <span className="font-semibold tabular-nums">× {item.portions}</span>
            </li>
          ))}
        </ul>
        <div className={cn("flex items-center justify-between gap-3 border-t pt-3.5", isReady ? "border-pink" : "border-line")}>
          <span className="flex items-center gap-1.5 text-sm font-medium text-subtle">
            <Clock3 className="h-4 w-4" /> รับ {formatTime(order.pickup_at)} น.
          </span>
          <Button size="sm" variant={isReady ? "outline" : "default"} className={cn(isReady && "border-ink")} onClick={() => onUpdate(order.order_id, nextStatus)} disabled={updating}>
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : isReady ? <Check className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
            {isReady ? "ส่งมอบแล้ว" : "พร้อมเสิร์ฟ"}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

function OrderColumn({ title, description, orders, onUpdate, updatingId, ink = false }: { title: string; description: string; orders: Fulfillment[]; onUpdate: (orderId: string, status: NextStatus) => void; updatingId?: string; ink?: boolean }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5" aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <p className="text-xs text-subtle">{description}</p>
        </div>
        <span className={cn("grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-semibold", ink ? "bg-ink text-canvas" : "bg-line")}>{orders.length}</span>
      </div>
      <div className="space-y-3">
        <AnimatePresence>
          {orders.map((order) => <OrderTicket key={order.order_id} order={order} onUpdate={onUpdate} updating={updatingId === order.order_id} />)}
        </AnimatePresence>
        {!orders.length && (
          <div className="grid min-h-72 place-items-center rounded-2xl border-[1.5px] border-dashed border-line text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-canvas"><ShoppingBag className="h-6 w-6 text-subtle" strokeWidth={1.75} /></span>
              <p className="mt-3 text-[17px] font-semibold">ยังไม่มีออเดอร์ในคิว</p>
              <p className="mt-1 text-[13px] text-subtle">ออเดอร์ใหม่จะแสดงที่นี่อัตโนมัติ</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function StaffPage() {
  const orders = useFulfillments();
  const updateStatus = useUpdateFulfillmentStatus();
  const redirectingToLogin = useLoginOnUnauthorized(orders.error);
  const preparing = orders.data?.filter((order) => order.status === "PREPARING") ?? [];
  const ready = orders.data?.filter((order) => order.status === "READY_FOR_PICKUP") ?? [];
  const scoops = [...preparing, ...ready].reduce((sum, order) => sum + order.items.reduce((s, item) => s + item.portions, 0), 0);
  const nextPickup = [...preparing].sort((a, b) => a.pickup_at.localeCompare(b.pickup_at))[0];

  const handleUpdate = (orderId: string, status: NextStatus) => {
    updateStatus.mutate(
      { orderId, status },
      {
        onSuccess: () => toast.success(status === "READY_FOR_PICKUP" ? "แจ้งลูกค้าว่าพร้อมรับแล้ว" : "ปิดออเดอร์เรียบร้อย"),
        onError: (error) => toast.error(error instanceof Error ? error.message : "อัปเดตสถานะไม่สำเร็จ")
      }
    );
  };
  const updatingId = updateStatus.isPending ? updateStatus.variables?.orderId : undefined;

  return (
    <main className="mx-auto max-w-[76rem] space-y-7 px-6 pb-12 pt-8 lg:px-10">
      <PageHeader
        eyebrow={<Eyebrow live>LIVE · อัปเดตทุก 2 วินาที</Eyebrow>}
        title="จัดการออเดอร์ในครัว"
        description="ลำดับออเดอร์และส่งสัญญาณแจ้งลูกค้าเมื่อพร้อมรับ"
        actions={
          <Button variant="outline" onClick={() => void orders.refetch()} disabled={orders.isFetching}>
            <RefreshCw className={cn("h-4 w-4", orders.isFetching && "animate-spin")} /> รีเฟรช
          </Button>
        }
      />

      {orders.isError && orders.data && !redirectingToLogin && <StaleNotice />}

      {orders.isLoading || redirectingToLogin ? (
        <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-pink-strong" /></div>
      ) : !orders.data ? (
        <section className="flex flex-col items-center rounded-3xl border border-line bg-white px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-pink-soft"><RefreshCw className="h-6 w-6 text-pink-strong" /></span>
          <h2 className="mt-3 text-[17px] font-semibold">โหลดออเดอร์ไม่สำเร็จ</h2>
          <p className="mt-1 text-[13px] text-subtle">ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง</p>
          <Button className="mt-5 w-40" onClick={() => void orders.refetch()}>ลองใหม่</Button>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปคิว">
            <StatTile label="กำลังเตรียม" value={String(preparing.length)} note="ออเดอร์ในครัว" />
            <StatTile label="พร้อมรับ" value={String(ready.length)} note="รอลูกค้ามารับ" tone="pink" />
            <StatTile label="สกู๊ปในคิว" value={String(scoops)} note="รวมทุกออเดอร์" />
            <StatTile label="รับถัดไป" value={nextPickup ? `${formatTime(nextPickup.pickup_at)} น.` : "—"} note={nextPickup ? `คิว #${nextPickup.queue_number}` : "ไม่มีออเดอร์ค้าง"} tone="ink" />
          </section>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <OrderColumn title="กำลังเตรียม" description="คิวที่กำลังทำ" orders={preparing} onUpdate={handleUpdate} updatingId={updatingId} />
            <OrderColumn title="พร้อมรับ" description="รอลูกค้ามารับที่เคาน์เตอร์" orders={ready} onUpdate={handleUpdate} updatingId={updatingId} ink />
          </div>
        </>
      )}
    </main>
  );
}
