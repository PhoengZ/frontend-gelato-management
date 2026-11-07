"use client";

import { useState } from "react";
import { BellRing, Check, ChefHat, Clock3, Loader2, RefreshCw, Search, ShoppingBag, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Eyebrow, PageHeader, StatTile } from "@/components/backoffice/PageParts";
import { StaleNotice, useLoginOnUnauthorized } from "@/components/StaleNotice";
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
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useFulfillmentLookup, useFulfillments, useStoreCancelOrder, useUpdateFulfillmentStatus } from "@/lib/api";
import { cn, formatTime } from "@/lib/utils";
import type { Fulfillment, FulfillmentStatus, UpdateFulfillmentStatusRequest } from "@/types";

type NextStatus = UpdateFulfillmentStatusRequest["status"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const statusBadge: Record<FulfillmentStatus, { label: string; tone: NonNullable<BadgeProps["tone"]> }> = {
  QUEUED: { label: "รอคิว", tone: "soft" },
  PREPARING: { label: "กำลังเตรียม", tone: "neutral" },
  READY_FOR_PICKUP: { label: "พร้อมรับ", tone: "ink" },
  PICKED_UP: { label: "รับแล้ว", tone: "success" },
  CANCELLED: { label: "ยกเลิกแล้ว", tone: "neutral" }
};

/** The single forward move the kitchen can make from each status, per the Fulfillment contract. */
const nextStep: Partial<Record<FulfillmentStatus, { status: NextStatus; label: string; done: string }>> = {
  QUEUED: { status: "PREPARING", label: "เริ่มเตรียม", done: "เริ่มเตรียมออเดอร์แล้ว" },
  PREPARING: { status: "READY_FOR_PICKUP", label: "พร้อมรับ", done: "แจ้งลูกค้าว่าพร้อมรับแล้ว" },
  READY_FOR_PICKUP: { status: "PICKED_UP", label: "ส่งมอบแล้ว", done: "ปิดออเดอร์เรียบร้อย" }
};

const queueOrder = (a: Fulfillment, b: Fulfillment) =>
  Number(a.queue_number) - Number(b.queue_number) || a.queue_number.localeCompare(b.queue_number);

/** Pickup slots in time order, each with its tickets in queue-number order. */
function groupBySlot(tickets: Fulfillment[]) {
  const slots = new Map<string, Fulfillment[]>();
  for (const ticket of tickets) slots.set(ticket.pickup_at, [...(slots.get(ticket.pickup_at) ?? []), ticket]);
  return Array.from(slots.entries())
    .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
    .map(([pickupAt, slotTickets]) => ({ pickupAt, tickets: slotTickets.sort(queueOrder) }));
}

/** A query matches a queue number ("3", "#03") or the start of an order id, ignoring case. */
function matchesSearch(ticket: Fulfillment, query: string) {
  const queue = query.replace(/^#/, "");
  if (/^\d+$/.test(queue) && Number(queue) === Number(ticket.queue_number)) return true;
  return ticket.order_id.toLowerCase().startsWith(query.toLowerCase());
}

interface TicketActions {
  onAdvance: (ticket: Fulfillment, status: NextStatus) => void;
  onCancel: (ticket: Fulfillment) => void;
  busyId?: string;
}

/** Figma: OrderTicket — Queued / Preparing / Ready, plus picked-up and cancelled from search. */
function OrderTicket({ ticket, onAdvance, onCancel, busyId }: { ticket: Fulfillment } & TicketActions) {
  const isReady = ticket.status === "READY_FOR_PICKUP";
  const step = nextStep[ticket.status];
  const busy = busyId === ticket.order_id;
  const badge = statusBadge[ticket.status];
  const StepIcon = ticket.status === "QUEUED" ? ChefHat : isReady ? Check : BellRing;
  return (
    <motion.article layout aria-label={`คิว ${ticket.queue_number}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
      <div className={cn("space-y-3.5 rounded-3xl border p-4", isReady ? "border-pink bg-pink-soft" : "border-line bg-white")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-subtle">คิว · #{ticket.order_id.slice(0, 8).toUpperCase()}</p>
            <h3 className="text-[34px] font-bold leading-none tracking-[-0.02em]">#{ticket.queue_number}</h3>
          </div>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        <ul className="space-y-1 text-[15px]">
          {ticket.items.map((item) => (
            <li key={item.flavor_id} className="flex justify-between gap-3">
              <span>{item.flavor_name}</span>
              <span className="font-semibold tabular-nums">× {item.portions}</span>
            </li>
          ))}
        </ul>
        <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t pt-3.5", isReady ? "border-pink" : "border-line")}>
          <span className="flex items-center gap-1.5 text-sm font-medium text-subtle">
            <Clock3 className="h-4 w-4" /> รับ {formatTime(ticket.pickup_at)} น.
          </span>
          {step && (
            <div className="flex gap-2">
              {ticket.status === "QUEUED" && (
                <Button size="sm" variant="outline" onClick={() => onCancel(ticket)} disabled={busy}>
                  <X className="h-4 w-4" /> ยกเลิก
                </Button>
              )}
              <Button size="sm" variant={isReady ? "outline" : "default"} className={cn(isReady && "border-ink")} onClick={() => onAdvance(ticket, step.status)} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <StepIcon className="h-4 w-4" />}
                {step.label}
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function SlotSection({ pickupAt, tickets, ...actions }: { pickupAt: string; tickets: Fulfillment[] } & TicketActions) {
  const label = `รอบรับ ${formatTime(pickupAt)} น.`;
  const queued = tickets.filter((ticket) => ticket.status === "QUEUED").length;
  return (
    <section className="rounded-3xl border border-line bg-white p-5" aria-label={label}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold">{label}</h2>
          <p className="text-xs text-subtle">{tickets.length} ออเดอร์{queued ? ` · รอเริ่ม ${queued}` : ""}</p>
        </div>
        <span className="grid h-9 min-w-9 place-items-center rounded-full bg-line px-2 text-sm font-semibold">{tickets.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence>
          {tickets.map((ticket) => <OrderTicket key={ticket.order_id} ticket={ticket} {...actions} />)}
        </AnimatePresence>
      </div>
    </section>
  );
}

function EmptyQueue({ searching }: { searching: boolean }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-3xl border-[1.5px] border-dashed border-line bg-white text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-canvas"><ShoppingBag className="h-6 w-6 text-subtle" strokeWidth={1.75} /></span>
        <p className="mt-3 text-[17px] font-semibold">{searching ? "ไม่พบออเดอร์ที่ตรงกับคำค้น" : "ยังไม่มีออเดอร์ในคิว"}</p>
        <p className="mt-1 text-[13px] text-subtle">{searching ? "ลองพิมพ์หมายเลขคิว หรือเลขออเดอร์เต็มเพื่อค้นหาออเดอร์ที่รับไปแล้ว" : "ออเดอร์ใหม่จะแสดงที่นี่อัตโนมัติ"}</p>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const [query, setQuery] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Fulfillment | null>(null);
  const orders = useFulfillments();
  const updateStatus = useUpdateFulfillmentStatus();
  const storeCancel = useStoreCancelOrder();
  const redirectingToLogin = useLoginOnUnauthorized(orders.error);

  const all = orders.data ?? [];
  const search = query.trim();
  const visible = search ? all.filter((ticket) => matchesSearch(ticket, search)) : all;
  // The list holds only active tickets, so a full order id that is not in it is looked up directly.
  const lookupId = UUID.test(search) && !all.some((ticket) => ticket.order_id.toLowerCase() === search.toLowerCase()) ? search.toLowerCase() : null;
  const lookup = useFulfillmentLookup(lookupId);
  const lookedUp = lookupId ? lookup.data : undefined;

  const count = (status: FulfillmentStatus) => all.filter((ticket) => ticket.status === status).length;
  const nextPickup = all.filter((ticket) => ticket.status === "QUEUED" || ticket.status === "PREPARING").sort((a, b) => a.pickup_at.localeCompare(b.pickup_at) || queueOrder(a, b))[0];

  const advance = (ticket: Fulfillment, status: NextStatus) => {
    updateStatus.mutate(
      { orderId: ticket.order_id, status },
      {
        onSuccess: () => toast.success(nextStep[ticket.status]?.done ?? "อัปเดตสถานะแล้ว"),
        onError: (error) => toast.error(error instanceof Error ? error.message : "อัปเดตสถานะไม่สำเร็จ")
      }
    );
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    storeCancel.mutate(cancelTarget.order_id, {
      onSuccess: () => toast.success(`ยกเลิกคิว #${cancelTarget.queue_number} และคืนสต็อกแล้ว`),
      onError: (error) => toast.error(error instanceof Error ? error.message : "ยกเลิกออเดอร์ไม่สำเร็จ")
    });
    setCancelTarget(null);
  };

  const busyId = updateStatus.isPending ? updateStatus.variables?.orderId : storeCancel.isPending ? storeCancel.variables : undefined;
  const actions: TicketActions = { onAdvance: advance, onCancel: setCancelTarget, busyId };

  return (
    <main className="mx-auto max-w-[76rem] space-y-7 px-4 pb-12 pt-8 sm:px-6 lg:px-10">
      <PageHeader
        eyebrow={<Eyebrow live>LIVE · อัปเดตทุก 2 วินาที</Eyebrow>}
        title="จัดการออเดอร์ในครัว"
        description="เรียงตามรอบรับสินค้า เริ่มเตรียม แจ้งพร้อมรับ และส่งมอบให้ลูกค้า"
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
            <StatTile label="รอคิว" value={String(count("QUEUED"))} note="ชำระแล้ว รอเริ่มเตรียม" />
            <StatTile label="กำลังเตรียม" value={String(count("PREPARING"))} note="ออเดอร์ในครัว" />
            <StatTile label="พร้อมรับ" value={String(count("READY_FOR_PICKUP"))} note="รอลูกค้ามารับ" tone="pink" />
            <StatTile label="รับถัดไป" value={nextPickup ? `${formatTime(nextPickup.pickup_at)} น.` : "—"} note={nextPickup ? `คิว #${nextPickup.queue_number}` : "ไม่มีออเดอร์ค้าง"} tone="ink" />
          </section>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <Input
              type="search"
              aria-label="ค้นหาคิวหรือเลขออเดอร์"
              placeholder="ค้นหาหมายเลขคิว หรือเลขออเดอร์"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-10"
            />
          </div>

          {lookupId && (
            <section className="space-y-3" aria-label="ผลการค้นหาเลขออเดอร์">
              {lookedUp ? (
                <div className="max-w-md"><OrderTicket ticket={lookedUp} {...actions} /></div>
              ) : lookup.isFetching ? (
                <p className="flex items-center gap-2 text-sm text-subtle"><Loader2 className="h-4 w-4 animate-spin" /> กำลังค้นหาออเดอร์…</p>
              ) : lookedUp === null ? (
                <p className="text-sm text-subtle">ไม่พบออเดอร์นี้</p>
              ) : null}
            </section>
          )}

          {visible.length ? (
            <div className="space-y-5">
              {groupBySlot(visible).map((slot) => <SlotSection key={slot.pickupAt} pickupAt={slot.pickupAt} tickets={slot.tickets} {...actions} />)}
            </div>
          ) : (
            !lookedUp && <EmptyQueue searching={Boolean(search)} />
          )}
        </>
      )}

      <AlertDialog open={Boolean(cancelTarget)} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยกเลิกออเดอร์คิว #{cancelTarget?.queue_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะคืนสต็อกทันที แต่ไม่คืนเงินอัตโนมัติ ร้านต้องติดต่อลูกค้าเพื่อคืนเงินเอง ยกเลิกได้เฉพาะออเดอร์ที่ยังไม่เริ่มเตรียม
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={confirmCancel}>ยืนยันยกเลิกออเดอร์</AlertDialogAction>
            <AlertDialogCancel>ไม่ยกเลิก</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
