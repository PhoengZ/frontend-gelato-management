"use client";

import Image from "next/image";
import { CheckCheck, Clock3, Loader2, PackageCheck, RefreshCw, ShoppingBag } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFulfillments, useUpdateOrderStatus } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import type { FulfillmentStatus, StaffOrder } from "@/types";
import vanillaGelato from "@/public/hero/3.png";

function OrderCard({ order, onUpdate, updating }: { order: StaffOrder; onUpdate: (orderId: string, status: FulfillmentStatus) => void; updating: boolean }) {
  const nextStatus: FulfillmentStatus = order.status === "READY" ? "PICKED_UP" : "READY";
  return (
    <motion.article layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
      <Card className="border border-black/10 bg-white p-6 transition-all hover:border-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/60">TICKET NO.</p>
            <h3 className="mt-1 font-mono text-4xl font-black text-black">#{order.queueNumber}</h3>
          </div>
          <Badge className={order.status === "READY" ? "border border-black bg-black text-white px-3 py-1 text-[10px] uppercase tracking-widest" : "border border-black/20 bg-stone-100 text-black px-3 py-1 text-[10px] uppercase tracking-widest"}>
            {order.status === "READY" ? "READY FOR PICKUP" : "PREPARING"}
          </Badge>
        </div>
        <div className="mt-5 space-y-2 border-y border-black/10 py-4">
          {order.items.map((item) => (
            <div key={item.flavorId} className="flex justify-between gap-3 text-xs uppercase tracking-wide">
              <span className="font-bold text-black">{item.flavorName}</span>
              <span className="shrink-0 font-mono font-black text-black">× {item.portions}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-black/60">
            <Clock3 className="h-3.5 w-3.5 text-black" /> {formatTime(order.createdAt)} N.
          </span>
          <Button 
            onClick={() => onUpdate(order.orderId, nextStatus)} 
            disabled={updating} 
            variant={order.status === "READY" ? "outline" : "default"}
          >
            {updating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : order.status === "READY" ? <CheckCheck className="mr-2 h-3.5 w-3.5" /> : <PackageCheck className="mr-2 h-3.5 w-3.5" />}
            {order.status === "READY" ? "COMPLETE ORDER" : "MARK READY"}
          </Button>
        </div>
      </Card>
    </motion.article>
  );
}

function OrderColumn({ title, description, orders, onUpdate, updatingId }: { title: string; description: string; orders: StaffOrder[]; onUpdate: (orderId: string, status: FulfillmentStatus) => void; updatingId?: string }) {
  return (
    <section className="min-h-[34rem] border border-black bg-white p-6">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-black/10 pb-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wider text-black">{title}</h2>
          <p className="text-xs uppercase tracking-widest text-black/60">{description}</p>
        </div>
        <span className="flex h-8 min-w-8 items-center justify-center border border-black bg-black font-mono text-xs font-black text-white">
          {orders.length}
        </span>
      </div>
      <div className="space-y-4">
        <AnimatePresence>
          {orders.map((order) => <OrderCard key={order.orderId} order={order} onUpdate={onUpdate} updating={updatingId === order.orderId} />)}
        </AnimatePresence>
        {!orders.length && (
          <div className="grid min-h-64 place-items-center border border-dashed border-black/20 text-center text-black/40">
            <div>
              <ShoppingBag className="mx-auto h-8 w-8 opacity-30" />
              <p className="mt-3 text-xs font-bold uppercase tracking-widest">NO ORDERS IN QUEUE</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function StaffPage() {
  const orders = useFulfillments();
  const updateStatus = useUpdateOrderStatus();
  const preparing = orders.data?.filter((order) => order.status === "PREPARING" || order.status === "PAID") ?? [];
  const ready = orders.data?.filter((order) => order.status === "READY") ?? [];

  const handleUpdate = (orderId: string, status: FulfillmentStatus) => {
    updateStatus.mutate(
      { orderId, status },
      {
        onSuccess: () => toast.success(status === "READY" ? "แจ้งลูกค้าว่าพร้อมรับแล้ว" : "ปิดออเดอร์เรียบร้อย"),
        onError: (error) => toast.error(error instanceof Error ? error.message : "อัปเดตสถานะไม่สำเร็จ")
      }
    );
  };

  return (
    <main className="w-full pb-24">
      {/* Pink Hero Banner for Kitchen Header - Full Width */}
      <div className="relative w-full overflow-hidden border-b border-black bg-[#f79bad] px-6 py-8 sm:px-10 sm:py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 border border-black bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black">
              <span className="h-1.5 w-1.5 animate-pulse bg-black" /> LIVE KITCHEN FEED — 2S REFRESH
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-[#32111c] sm:text-5xl">
              KITCHEN FULFILLMENT
            </h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[#631c31]">
              จัดการลำดับออเดอร์และส่งสัญญาณแจ้งเตือนลูกค้ารับสินค้า
            </p>
          </div>
          <Button
            variant="outline"
            className="relative z-10 border-black bg-white text-black hover:bg-stone-100"
            onClick={() => void orders.refetch()}
            disabled={orders.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${orders.isFetching ? "animate-spin" : ""}`} /> REFRESH
          </Button>
        </div>

        {/* Overlayed Gelato Image */}
        <div className="pointer-events-none absolute -bottom-6 right-4 z-0 sm:right-16 md:right-28">
          <Image
            src={vanillaGelato}
            alt="Gelato decor"
            width={176}
            height={176}
            className="h-32 w-32 object-contain sm:h-44 sm:w-44"
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-8">
        {orders.isLoading ? (
          <div className="grid min-h-[55vh] place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-black" />
          </div>
        ) : orders.isError ? (
          <Card className="border border-black bg-white p-12 text-center">
            <h2 className="text-xl font-bold uppercase tracking-wider">FAILED TO LOAD ORDERS</h2>
            <p className="mt-2 text-xs uppercase tracking-widest text-black/60">กรุณาตรวจสอบการเชื่อมต่อ API Gateway</p>
            <Button className="mt-6" onClick={() => void orders.refetch()}>RETRY</Button>
          </Card>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            <OrderColumn title="IN PREPARATION" description="QUEUE IN PROGRESS" orders={preparing} onUpdate={handleUpdate} updatingId={updateStatus.variables?.orderId} />
            <OrderColumn title="READY FOR PICKUP" description="AWAITING COUNTER COLLECT" orders={ready} onUpdate={handleUpdate} updatingId={updateStatus.variables?.orderId} />
          </div>
        )}
      </div>
    </main>
  );
}
