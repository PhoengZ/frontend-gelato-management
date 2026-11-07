"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Archive, BarChart3, Boxes, Loader2, PackagePlus, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, StatTile } from "@/components/backoffice/PageParts";
import { StaleNotice, useLoginOnUnauthorized } from "@/components/StaleNotice";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useArchiveFlavor, useCreateBatch, useCreateFlavor, useInventory, useRecordWaste, useUpdateFlavor } from "@/lib/api";
import { allergenLabels, cn, dateInputValue, flavorTint, formatDateTime, formatMinor } from "@/lib/utils";
import { ALLERGENS, WASTE_REASONS, type Allergen, type BatchStatus, type CreateFlavorRequest, type MenuFlavor, type WasteReason } from "@/types";

const wasteReasonLabels: Record<WasteReason, string> = {
  EXPIRED: "หมดอายุ",
  DAMAGED: "เสียหาย / ละลาย",
  QUALITY: "ไม่ผ่านการตรวจคุณภาพ",
  ADJUSTMENT: "ปรับยอดสต็อก"
};

const batchTone: Record<BatchStatus, "success" | "neutral" | "soft"> = {
  ACTIVE: "success",
  EXHAUSTED: "neutral",
  EXPIRED: "soft",
  ARCHIVED: "neutral"
};

const EXPIRING_WINDOW_MS = 48 * 60 * 60_000;

/** Baht entered in a form → integer satang. */
function toMinor(baht: FormDataEntryValue | null) {
  return Math.round(Number(baht) * 100);
}

function dateTimeInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function flavorPayload(data: FormData): Omit<CreateFlavorRequest, "recipe"> {
  const imageUrl = String(data.get("image_url") ?? "").trim();
  return {
    name: String(data.get("name")).trim(),
    description: String(data.get("description")).trim(),
    price: { amount_minor: toMinor(data.get("price")), currency: "THB" },
    allergens: data.getAll("allergens").map(String) as Allergen[],
    ...(imageUrl ? { image_url: imageUrl } : {}),
    active: data.get("active") === "on"
  };
}

function AllergenFields({ selected = [] }: { selected?: Allergen[] }) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-subtle">สารก่อภูมิแพ้</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALLERGENS.map((allergen) => (
          <label key={allergen} className="cursor-pointer">
            <input type="checkbox" name="allergens" value={allergen} defaultChecked={selected.includes(allergen)} className="peer sr-only" />
            <span className="inline-flex h-9 items-center rounded-full border border-line bg-white px-4 text-sm transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas peer-focus-visible:ring-2 peer-focus-visible:ring-ink">
              {allergenLabels[allergen]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ActiveToggle({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-line bg-white px-4 py-3">
      <span>
        <span className="block text-sm font-medium">เปิดขาย</span>
        <span className="block text-xs text-subtle">ปิดเพื่อซ่อนเมนูนี้จากลูกค้า</span>
      </span>
      <input name="active" type="checkbox" defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative h-7 w-12 rounded-full bg-line transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-ink peer-checked:after:translate-x-5" aria-hidden="true" />
    </label>
  );
}

/** Right-hand drawer used for both creating and editing a menu item. */
function FlavorDrawer({ flavor, open, onOpenChange }: { flavor: MenuFlavor | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const createFlavor = useCreateFlavor();
  const updateFlavor = useUpdateFlavor();
  const editing = Boolean(flavor);
  const pending = createFlavor.isPending || updateFlavor.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const done = { onSuccess: () => { toast.success(editing ? `อัปเดต ${flavor?.name} แล้ว` : "เพิ่มเมนูใหม่แล้ว"); onOpenChange(false); }, onError: (error: Error) => toast.error(error.message) };
    if (flavor) updateFlavor.mutate({ flavorId: flavor.id, ...flavorPayload(data) }, done);
    else createFlavor.mutate({ ...flavorPayload(data), recipe: String(data.get("recipe")).trim() }, done);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <SheetContent side="right" className="p-6 pt-6">
        <SheetHeader>
          <SheetTitle>{editing ? `แก้ไข ${flavor?.name}` : "เพิ่มเมนูใหม่"}</SheetTitle>
          <SheetDescription>{editing ? "แก้ไขราคา รายละเอียด รูปภาพ และสถานะการขาย" : "สต็อกของเมนูมาจาก Batch ที่สร้างภายหลัง"}</SheetDescription>
        </SheetHeader>
        <form key={flavor?.id ?? "new"} onSubmit={submit} className="space-y-4">
          <Field label="ชื่อเมนู"><Input name="name" required maxLength={100} defaultValue={flavor?.name} placeholder="Dark Chocolate" /></Field>
          <Field label="ราคา / สกู๊ป (บาท)"><Input name="price" required type="number" min="0" step="0.01" defaultValue={flavor ? flavor.price.amount_minor / 100 : undefined} placeholder="95" /></Field>
          <Field label="คำอธิบาย"><Textarea name="description" required maxLength={1000} rows={2} defaultValue={flavor?.description} placeholder="คำอธิบายรสชาติ" /></Field>
          <Field label="ลิงก์รูปภาพ" hint="แนะนำ PNG พื้นหลังโปร่งใส"><Input name="image_url" type="url" defaultValue={flavor?.image_url ?? ""} placeholder="https://example.com/gelato.png" /></Field>
          {!editing && <Field label="สูตร (เห็นเฉพาะผู้จัดการ)"><Textarea name="recipe" required rows={3} placeholder="ส่วนผสมและขั้นตอน" /></Field>}
          <AllergenFields selected={flavor?.allergens} />
          <ActiveToggle defaultChecked={flavor?.active ?? true} />
          <div className="flex gap-2.5 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={pending}>ยกเลิก</Button>
            <Button type="submit" className="flex-1" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "บันทึก" : "สร้างเมนู"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function ManagerPage() {
  const inventory = useInventory();
  const redirectingToLogin = useLoginOnUnauthorized(inventory.error);
  const createBatch = useCreateBatch();
  const archiveFlavor = useArchiveFlavor();
  const recordWaste = useRecordWaste();
  const [drawer, setDrawer] = useState<{ open: boolean; flavor: MenuFlavor | null }>({ open: false, flavor: null });
  // One key per waste entry so a retried submit is not recorded twice.
  const [wasteKey, setWasteKey] = useState(() => crypto.randomUUID());
  // Captured once per visit; the expiry window does not need to tick live.
  const [now] = useState(() => Date.now());

  const submitBatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const batchCode = String(data.get("batch_code") ?? "").trim();
    createBatch.mutate({
      ...(batchCode ? { batch_code: batchCode } : {}),
      flavor_id: String(data.get("flavor_id")),
      production_date: String(data.get("production_date")),
      expires_at: new Date(String(data.get("expires_at"))).toISOString(),
      initial_portions: Number(data.get("initial_portions")),
      unit_cost_minor: toMinor(data.get("unit_cost")),
      currency: "THB"
    }, { onSuccess: () => { toast.success("สร้าง Batch และเพิ่มสต็อกแล้ว"); form.reset(); }, onError: (error) => toast.error(error.message) });
  };

  const submitWaste = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const note = String(data.get("note") ?? "").trim();
    recordWaste.mutate({
      batchId: String(data.get("batch_id")),
      portions: Number(data.get("portions")),
      reason: String(data.get("reason")) as WasteReason,
      ...(note ? { note } : {}),
      idempotency_key: wasteKey
    }, {
      onSuccess: () => { toast.success("บันทึกของเสียและตัดสต็อกแล้ว"); form.reset(); setWasteKey(crypto.randomUUID()); },
      onError: (error) => toast.error(error.message)
    });
  };

  const archive = (flavor: MenuFlavor) => {
    if (window.confirm(`เก็บเมนู ${flavor.name} เข้าคลัง? เมนูจะถูกซ่อนจากลูกค้า แต่ประวัติ Batch ยังอยู่และเปิดขายใหม่ได้`)) {
      archiveFlavor.mutate(flavor.id, { onSuccess: () => toast.success(`เก็บ ${flavor.name} เข้าคลังแล้ว`), onError: (error) => toast.error(error.message) });
    }
  };

  if (inventory.isLoading || redirectingToLogin) return <main className="grid min-h-[70vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-pink-strong" /></main>;
  if (!inventory.data) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-6 text-center">
        <div>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-pink-soft"><RefreshCw className="h-6 w-6 text-pink-strong" /></span>
          <h1 className="mt-3 text-[22px] font-semibold">โหลดคลังสินค้าไม่สำเร็จ</h1>
          <p className="mt-1 text-sm text-subtle">{inventory.error?.message}</p>
          <Button className="mt-5 w-40" onClick={() => void inventory.refetch()}>ลองใหม่</Button>
        </div>
      </main>
    );
  }

  const { flavors, batches } = inventory.data;
  const flavorNames = new Map(flavors.map((flavor) => [flavor.id, flavor.name]));
  const activeBatches = batches.filter((batch) => batch.status === "ACTIVE");
  const wasteableBatches = activeBatches.filter((batch) => batch.available_portions > 0);
  const expiringSoon = activeBatches.filter((batch) => new Date(batch.expires_at).getTime() - now < EXPIRING_WINDOW_MS).length;
  const sellable = flavors.reduce((sum, flavor) => sum + (flavor.active ? flavor.available_portions : 0), 0);
  const wasted = batches.reduce((sum, batch) => sum + batch.wasted_portions, 0);
  const today = new Date(now);

  return (
    <main className="mx-auto max-w-[76rem] space-y-7 px-6 pb-12 pt-8 lg:px-10">
      {inventory.isError && <StaleNotice />}
      <PageHeader
        title="เมนูและคลังสินค้า"
        description="เพิ่ม แก้ไข และเก็บเมนูเข้าคลัง พร้อมจัดการ Batch สต็อก และของเสีย"
        actions={
          <>
            <Link href="/analytics" className={buttonVariants({ variant: "outline" })}><BarChart3 className="h-4 w-4" /> ดูรายงาน</Link>
            <Button onClick={() => setDrawer({ open: true, flavor: null })}><Plus className="h-4 w-4" /> เพิ่มเมนูใหม่</Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปคลังสินค้า">
        <StatTile label="เมนูที่เปิดขาย" value={`${flavors.filter((flavor) => flavor.active).length} / ${flavors.length}`} note="เมนูทั้งหมดในแคตตาล็อก" />
        <StatTile label="สกู๊ปพร้อมขาย" value={String(sellable)} note="จาก Batch ที่ใช้งานอยู่" />
        <StatTile label="Batch ใกล้หมดอายุ" value={String(expiringSoon)} note="ภายใน 48 ชั่วโมง" tone="pink" />
        <StatTile label="ของเสียสะสม" value={`${wasted} สกู๊ป`} note="รวมทุก Batch" tone="ink" />
      </section>

      <Panel title="เมนูเจลาโต" description="แก้ไขราคา รายละเอียด รูปภาพ และสถานะการขาย · สต็อกมาจาก Batch" icon={<Boxes className="h-5 w-5" />}>
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line text-xs text-subtle">
              <tr>
                <th className="py-3 pl-6 font-medium">เมนู</th>
                <th className="font-medium">ราคา / สกู๊ป</th>
                <th className="font-medium">พร้อมขาย</th>
                <th className="font-medium">สารก่อภูมิแพ้</th>
                <th className="font-medium">สถานะ</th>
                <th className="pr-6 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {flavors.map((flavor) => (
                <tr key={flavor.id} className={cn("border-b border-line last:border-0", !flavor.active && "text-subtle")}>
                  <td className="py-3 pl-6">
                    <div className="flex items-center gap-3">
                      <span className={cn("relative h-12 w-12 shrink-0 overflow-hidden rounded-xl", flavorTint(flavor.name), !flavor.active && "opacity-50")}>
                        <Image src={flavor.image_url ?? "/hero/3.png"} alt="" fill sizes="48px" className="object-contain" unoptimized={Boolean(flavor.image_url)} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{flavor.name}</span>
                        <span className="block max-w-xs truncate text-xs text-subtle">{flavor.description}</span>
                      </span>
                    </div>
                  </td>
                  <td className="tabular-nums">{formatMinor(flavor.price.amount_minor)}</td>
                  <td className="font-semibold tabular-nums">{flavor.available_portions} สกู๊ป</td>
                  <td className="max-w-[12rem] text-xs text-subtle">{flavor.allergens.map((allergen) => allergenLabels[allergen]).join(" · ") || "—"}</td>
                  <td><Badge tone={flavor.active ? "success" : "neutral"}>{flavor.active ? "เปิดขาย" : "เก็บเข้าคลัง"}</Badge></td>
                  <td className="pr-6">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setDrawer({ open: true, flavor })} aria-label={`แก้ไข ${flavor.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="hover:bg-pink-soft hover:text-pink-strong" disabled={!flavor.active || archiveFlavor.isPending} onClick={() => archive(flavor)} aria-label={`เก็บ ${flavor.name} เข้าคลัง`} title="เก็บเข้าคลัง (ซ่อนจากเมนู เปิดขายใหม่ได้ภายหลัง)">
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!flavors.length && <p className="py-10 text-center text-sm text-subtle">ยังไม่มีเมนู — เริ่มจากปุ่ม “เพิ่มเมนูใหม่”</p>}
        </div>
      </Panel>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel title="สร้าง Batch ใหม่" description="ผลิตเพิ่มแล้วบันทึกเพื่อเพิ่มสต็อกพร้อมขาย" icon={<PackagePlus className="h-5 w-5" />}>
          <form onSubmit={submitBatch} className="grid gap-4 sm:grid-cols-2">
            <Field label="รสชาติ">
              <Select name="flavor_id" required>{flavors.filter((flavor) => flavor.active).map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}</Select>
            </Field>
            <Field label="รหัส Batch (ไม่บังคับ)"><Input name="batch_code" pattern="\s*[A-Za-z0-9][A-Za-z0-9_\-]{0,63}\s*" placeholder="GF-20261011-CHOC-01" /></Field>
            <Field label="จำนวนสกู๊ป"><Input name="initial_portions" required type="number" min="1" step="1" placeholder="40" /></Field>
            <Field label="ต้นทุน / สกู๊ป (บาท)"><Input name="unit_cost" required type="number" min="0" step="0.01" defaultValue="0" /></Field>
            <Field label="วันที่ผลิต"><Input name="production_date" required type="date" defaultValue={dateInputValue(today)} /></Field>
            <Field label="หมดอายุ"><Input name="expires_at" required type="datetime-local" defaultValue={dateTimeInputValue(new Date(today.getTime() + 3 * 24 * 60 * 60_000))} /></Field>
            <Button type="submit" className="sm:col-span-2" disabled={createBatch.isPending}>{createBatch.isPending && <Loader2 className="h-4 w-4 animate-spin" />} สร้าง Batch และเพิ่มสต็อก</Button>
          </form>
        </Panel>

        <Panel title="บันทึกของเสีย" description="ตัดสต็อกจาก Batch ที่เสียหายหรือหมดอายุ" icon={<Trash2 className="h-5 w-5 text-pink-strong" />} className="bg-pink-soft/40">
          <form onSubmit={submitWaste} className="space-y-4">
            <Field label="Batch">
              <Select name="batch_id" required>{wasteableBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_code} · {flavorNames.get(batch.flavor_id) ?? "Unknown"} · เหลือ {batch.available_portions}</option>)}</Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="จำนวนสกู๊ปที่เสีย"><Input name="portions" required type="number" min="1" step="1" /></Field>
              <Field label="สาเหตุ"><Select name="reason" required>{WASTE_REASONS.map((reason) => <option key={reason} value={reason}>{wasteReasonLabels[reason]}</option>)}</Select></Field>
            </div>
            <Field label="หมายเหตุ (ไม่บังคับ)"><Input name="note" maxLength={500} placeholder="รายละเอียดเพิ่มเติม" /></Field>
            <Button type="submit" variant="secondary" className="w-full" disabled={recordWaste.isPending || !wasteableBatches.length}>{recordWaste.isPending && <Loader2 className="h-4 w-4 animate-spin" />} บันทึกของเสีย</Button>
          </form>
        </Panel>
      </div>

      <Panel title="Batch ทั้งหมด" description={`${activeBatches.length} Batch ที่ใช้งานอยู่`} icon={<Boxes className="h-5 w-5" />}>
        <div className="-mx-6 overflow-x-auto">
          <table aria-label="Batch ทั้งหมด" className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-line text-xs text-subtle">
              <tr>
                <th className="py-3 pl-6 font-medium">Batch</th><th className="font-medium">รสชาติ</th><th className="font-medium">ผลิต</th><th className="font-medium">หมดอายุ</th><th className="font-medium">สถานะ</th>
                {/* Portion counters come straight from Batch Inventory, the owner of stock. */}
                <th className="text-right font-medium">ผลิตทั้งหมด</th><th className="text-right font-medium">จอง</th><th className="text-right font-medium">ขายแล้ว</th><th className="text-right font-medium">ของเสีย</th><th className="pr-6 text-right font-medium">คงเหลือพร้อมขาย</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const soon = batch.status === "ACTIVE" && new Date(batch.expires_at).getTime() - now < EXPIRING_WINDOW_MS;
                return (
                  <tr key={batch.id} className="border-b border-line last:border-0">
                    <td className="py-3.5 pl-6 font-mono text-xs font-semibold">{batch.batch_code}</td>
                    <td>{flavorNames.get(batch.flavor_id) ?? "Unknown"}</td>
                    <td className="text-subtle">{batch.production_date}</td>
                    <td className={cn(soon ? "font-medium text-pink-strong" : "text-subtle")}>{formatDateTime(batch.expires_at)}</td>
                    <td><Badge tone={batchTone[batch.status]}>{batch.status}</Badge></td>
                    <td className="text-right tabular-nums">{batch.initial_portions}</td>
                    <td className="text-right tabular-nums">{batch.reserved_portions}</td>
                    <td className="text-right tabular-nums">{batch.sold_portions}</td>
                    <td className="text-right tabular-nums">{batch.wasted_portions}</td>
                    <td className="pr-6 text-right font-semibold tabular-nums">{batch.available_portions}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!batches.length && <p className="py-10 text-center text-sm text-subtle">ยังไม่มี Batch</p>}
        </div>
      </Panel>

      <FlavorDrawer flavor={drawer.flavor} open={drawer.open} onOpenChange={(open) => setDrawer((state) => ({ ...state, open }))} />
    </main>
  );
}
