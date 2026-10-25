"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Archive, Boxes, ChartNoAxesCombined, Loader2, PackagePlus, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useArchiveFlavor, useCreateBatch, useCreateFlavor, useInventory, useRecordWaste, useUpdateFlavor } from "@/lib/api";
import { allergenLabels, formatDateTime, formatMinor } from "@/lib/utils";
import { ALLERGENS, WASTE_REASONS, type Allergen, type CreateFlavorRequest, type WasteReason } from "@/types";
import strawberryHero from "@/public/hero/2.png";

const fieldClass = "mt-2 h-11 w-full border border-black/20 bg-white px-3 text-sm outline-none focus:border-[#e66f98]";
const darkFieldClass = "mt-1.5 h-10 w-full border border-white/20 bg-white/5 px-3 text-white outline-none focus:border-[#f79bad]";

const wasteReasonLabels: Record<WasteReason, string> = {
  EXPIRED: "Expired",
  DAMAGED: "Damaged / melted",
  QUALITY: "Quality control",
  ADJUSTMENT: "Stock adjustment"
};

/** Baht entered in a form → integer satang. */
function toMinor(baht: FormDataEntryValue | null) {
  return Math.round(Number(baht) * 100);
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
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

function AllergenFields({ selected = [], dark = false }: { selected?: Allergen[]; dark?: boolean }) {
  return (
    <fieldset className={`text-[10px] font-bold uppercase tracking-widest ${dark ? "text-white/50" : ""}`}>
      <legend>Allergens</legend>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {ALLERGENS.map((allergen) => (
          <label key={allergen} className={`flex items-center gap-1.5 normal-case tracking-normal ${dark ? "text-white/80" : "text-black"}`}>
            <input type="checkbox" name="allergens" value={allergen} defaultChecked={selected.includes(allergen)} className={`h-4 w-4 ${dark ? "accent-[#f79bad]" : "accent-black"}`} />
            {allergenLabels[allergen]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ManagerPage() {
  const inventory = useInventory();
  const createBatch = useCreateBatch();
  const createFlavor = useCreateFlavor();
  const updateFlavor = useUpdateFlavor();
  const archiveFlavor = useArchiveFlavor();
  const recordWaste = useRecordWaste();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  // One key per waste entry so a retried submit is not recorded twice.
  const [wasteKey, setWasteKey] = useState(() => crypto.randomUUID());

  const submitFlavor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    createFlavor.mutate({ ...flavorPayload(data), recipe: String(data.get("recipe")).trim() }, {
      onSuccess: () => { toast.success("เพิ่มเมนูใหม่แล้ว"); form.reset(); setShowCreateMenu(false); },
      onError: (error) => toast.error(error.message)
    });
  };

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

  if (inventory.isLoading) return <main className="grid min-h-[70vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
  if (inventory.isError || !inventory.data) return <main className="mx-auto max-w-xl p-10 text-center"><h1 className="text-2xl font-bold">โหลดคลังสินค้าไม่สำเร็จ</h1><p className="mt-2 text-sm text-black/60">{inventory.error?.message}</p><Button className="mt-5" onClick={() => void inventory.refetch()}>RETRY</Button></main>;

  const { flavors, batches } = inventory.data;
  const flavorNames = new Map(flavors.map((flavor) => [flavor.id, flavor.name]));
  const wasteableBatches = batches.filter((batch) => batch.status === "ACTIVE" && batch.available_portions > 0);
  const today = new Date();

  return (
    <main className="w-full pb-24">
      {/* Pink Hero Banner for Manager Header - Full Width */}
      <div className="relative w-full overflow-hidden border-b border-black bg-[#f79bad] px-6 py-8 sm:px-10 sm:py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 border border-black bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black">
              MANAGER ACCESS ONLY
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-[#32111c] sm:text-5xl">
              MENU & INVENTORY
            </h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[#631c31]">
              เพิ่ม แก้ไข และเก็บเมนูเข้าคลัง พร้อมจัดการ Batch สต็อก และของเสีย
            </p>
          </div>
          <Button asChild variant="outline" className="relative z-10 border-black bg-white text-black hover:bg-stone-100">
            <Link href="/analytics"><ChartNoAxesCombined className="mr-2 h-4 w-4" /> VIEW ANALYTICS</Link>
          </Button>
        </div>

        {/* Overlayed Gelato Image */}
        <div className="pointer-events-none absolute -bottom-6 right-4 z-0 sm:right-16 md:right-28">
          <Image
            src={strawberryHero}
            alt="Strawberry gelato"
            width={176}
            height={176}
            className="h-32 w-32 object-contain sm:h-44 sm:w-44"
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-8">

      <section className="border border-black bg-white p-6 sm:p-8" aria-labelledby="menu-management-heading">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c14f76]">Catalog management</p>
            <h2 id="menu-management-heading" className="mt-1 text-2xl font-black uppercase tracking-tight">Manage Gelato Menu</h2>
            <p className="mt-1 text-xs text-black/55">เพิ่มเมนูใหม่ หรือแก้ไขราคา รายละเอียด รูปภาพ และสถานะการขาย · สต็อกมาจาก Batch</p>
          </div>
          <Button type="button" onClick={() => setShowCreateMenu((value) => !value)}>
            <Plus className="h-4 w-4" /> {showCreateMenu ? "CANCEL" : "ADD NEW MENU"}
          </Button>
        </div>

        {showCreateMenu && (
          <form onSubmit={submitFlavor} className="mt-6 border border-black bg-[#fff3f7] p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-[10px] font-bold uppercase tracking-widest">Menu name<input name="name" required maxLength={100} placeholder="Dark Chocolate" className={fieldClass} /></label>
              <label className="text-[10px] font-bold uppercase tracking-widest">Price / scoop (THB)<input name="price" required type="number" min="0" step="0.01" placeholder="95" className={fieldClass} /></label>
              <label className="text-[10px] font-bold uppercase tracking-widest sm:col-span-2">Image URL<input name="image_url" type="url" placeholder="https://example.com/gelato.png" className={fieldClass} /></label>
              <label className="text-[10px] font-bold uppercase tracking-widest sm:col-span-2 lg:col-span-4">Description<input name="description" required maxLength={1000} placeholder="คำอธิบายรสชาติ" className={fieldClass} /></label>
              <label className="text-[10px] font-bold uppercase tracking-widest sm:col-span-2 lg:col-span-4">Recipe (manager only)<textarea name="recipe" required rows={3} placeholder="ส่วนผสมและขั้นตอน" className={`${fieldClass} h-auto py-2`} /></label>
              <div className="sm:col-span-2 lg:col-span-3"><AllergenFields /></div>
              <label className="flex items-center gap-2 self-end pb-1 text-[10px] font-bold uppercase tracking-widest"><input name="active" type="checkbox" defaultChecked className="h-4 w-4 accent-black" /> Available for sale</label>
            </div>
            <Button type="submit" className="mt-5 w-full sm:w-auto" disabled={createFlavor.isPending}>{createFlavor.isPending && <Loader2 className="h-4 w-4 animate-spin" />} CREATE MENU ITEM</Button>
          </form>
        )}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3" aria-label="Catalog inventory">
        {flavors.map((flavor) => (
          <Card key={flavor.id} className={`border border-black/15 bg-[#21171c] p-5 text-[#fff7ed] shadow-none ${flavor.active ? "" : "opacity-70"}`}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] uppercase tracking-widest text-white/45">{flavor.active ? "Catalog item" : "Archived"}</p><h2 className="mt-1 text-lg font-semibold uppercase">{flavor.name}</h2><p className="font-mono text-xs text-white/60">{formatMinor(flavor.price.amount_minor)}</p></div>
              <span className="bg-[#f79bad] px-2.5 py-1 font-mono text-xs font-bold text-black" title="Sellable portions from active batches">{flavor.available_portions}</span>
            </div>
            <form className="mt-5" onSubmit={(event) => {
              event.preventDefault();
              updateFlavor.mutate({ flavorId: flavor.id, ...flavorPayload(new FormData(event.currentTarget)) }, {
                onSuccess: () => toast.success(`อัปเดต ${flavor.name} แล้ว`), onError: (error) => toast.error(error.message)
              });
            }}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/50">Menu name<input name="name" required maxLength={100} defaultValue={flavor.name} className={darkFieldClass} /></label>
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/50">Price / scoop (THB)<input name="price" required type="number" min="0" step="0.01" defaultValue={flavor.price.amount_minor / 100} className={darkFieldClass} /></label>
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 sm:col-span-2 lg:col-span-1 xl:col-span-2">Description<input name="description" required maxLength={1000} defaultValue={flavor.description} className={darkFieldClass} /></label>
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 sm:col-span-2 lg:col-span-1 xl:col-span-2">Image URL<input name="image_url" type="url" defaultValue={flavor.image_url ?? ""} className={darkFieldClass} /></label>
                <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2"><AllergenFields selected={flavor.allergens} dark /></div>
              </div>
              <label className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/65"><input name="active" type="checkbox" defaultChecked={flavor.active} className="h-4 w-4 accent-[#f79bad]" /> Available for sale</label>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <Button type="submit" className="h-10" disabled={updateFlavor.isPending}><Save className="h-3.5 w-3.5" /> SAVE ITEM</Button>
                <Button type="button" variant="outline" className="h-10 border-white/30 bg-transparent px-3 text-white hover:bg-red-500 hover:text-white" disabled={!flavor.active || archiveFlavor.isPending} aria-label={`Archive ${flavor.name}`} title="Archive (ซ่อนจากเมนู เปิดขายใหม่ได้ภายหลัง)" onClick={() => {
                  if (window.confirm(`เก็บเมนู ${flavor.name} เข้าคลัง? เมนูจะถูกซ่อนจากลูกค้า แต่ประวัติ Batch ยังอยู่และเปิดขายใหม่ได้`)) archiveFlavor.mutate(flavor.id, { onSuccess: () => toast.success(`เก็บ ${flavor.name} เข้าคลังแล้ว`), onError: (error) => toast.error(error.message) });
                }}><Archive className="h-4 w-4" /></Button>
              </div>
            </form>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-2">
        <form onSubmit={submitBatch} className="border border-black bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3"><PackagePlus className="h-6 w-6 text-[#c14f76]" /><h2 className="text-xl font-bold uppercase tracking-wide">Create New Batch</h2></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-[10px] font-bold uppercase tracking-widest">Flavor<select name="flavor_id" required className={fieldClass}>{flavors.filter((flavor) => flavor.active).map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}</select></label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Batch code (optional)<input name="batch_code" pattern="\s*[A-Za-z0-9][A-Za-z0-9_\-]{0,63}\s*" placeholder="GF-20261011-CHOC-01" className={fieldClass} /></label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Portions<input name="initial_portions" required type="number" min="1" step="1" className={fieldClass} /></label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Unit cost (THB)<input name="unit_cost" required type="number" min="0" step="0.01" defaultValue="0" className={fieldClass} /></label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Production date<input name="production_date" required type="date" defaultValue={dateInputValue(today)} className={fieldClass} /></label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Expires at<input name="expires_at" required type="datetime-local" defaultValue={dateTimeInputValue(new Date(today.getTime() + 3 * 24 * 60 * 60_000))} className={fieldClass} /></label>
          </div>
          <Button type="submit" className="mt-6 w-full" disabled={createBatch.isPending}>{createBatch.isPending && <Loader2 className="h-4 w-4 animate-spin" />} CREATE BATCH & ADD STOCK</Button>
        </form>

        <form onSubmit={submitWaste} className="border border-black bg-[#fff3f7] p-6 sm:p-8">
          <div className="flex items-center gap-3"><Trash2 className="h-6 w-6 text-[#c14f76]" /><h2 className="text-xl font-bold uppercase tracking-wide">Record Waste</h2></div>
          <label className="mt-6 block text-[10px] font-bold uppercase tracking-widest">Batch<select name="batch_id" required className={fieldClass}>{wasteableBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_code} · {flavorNames.get(batch.flavor_id) ?? "Unknown"} · {batch.available_portions} left</option>)}</select></label>
          <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest">Waste portions<input name="portions" required type="number" min="1" step="1" className={fieldClass} /></label>
          <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest">Reason<select name="reason" required className={fieldClass}>{WASTE_REASONS.map((reason) => <option key={reason} value={reason}>{wasteReasonLabels[reason]}</option>)}</select></label>
          <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest">Note (optional)<input name="note" maxLength={500} placeholder="รายละเอียดเพิ่มเติม" className={fieldClass} /></label>
          <Button type="submit" variant="secondary" className="mt-6 w-full" disabled={recordWaste.isPending || !wasteableBatches.length}>{recordWaste.isPending && <Loader2 className="h-4 w-4 animate-spin" />} RECORD WASTE</Button>
        </form>
      </section>

      <section className="mt-8 border border-black bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3"><Boxes className="h-6 w-6" /><h2 className="text-xl font-bold uppercase tracking-wide">Batches</h2></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="border-b border-black text-[10px] uppercase tracking-widest"><tr><th className="py-3">Batch</th><th>Flavor</th><th>Produced</th><th>Expires</th><th>Status</th><th className="text-right">Available</th><th className="text-right">Reserved</th><th className="text-right">Sold</th><th className="text-right">Wasted</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id} className="border-b border-black/10"><td className="py-4 font-mono font-bold">{batch.batch_code}</td><td>{flavorNames.get(batch.flavor_id) ?? "Unknown"}</td><td>{batch.production_date}</td><td>{formatDateTime(batch.expires_at)}</td><td className="font-mono text-[10px]">{batch.status}</td><td className="text-right font-mono font-bold">{batch.available_portions} / {batch.initial_portions}</td><td className="text-right font-mono">{batch.reserved_portions}</td><td className="text-right font-mono">{batch.sold_portions}</td><td className="text-right font-mono">{batch.wasted_portions}</td></tr>)}</tbody></table></div>
        {!batches.length && <p className="py-10 text-center text-sm text-black/45">ยังไม่มี Batch</p>}
      </section>
      </div>
    </main>
  );
}
