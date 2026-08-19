"use client";

import { FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Boxes, ChartNoAxesCombined, Loader2, PackagePlus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCreateBatch, useInventory, useRecordWaste, useUpdateFlavorInventory } from "@/lib/api";
import strawberryHero from "@/public/hero/2.png";

const fieldClass = "mt-2 h-11 w-full border border-black/20 bg-white px-3 text-sm outline-none focus:border-[#e66f98]";

export default function ManagerPage() {
  const inventory = useInventory();
  const createBatch = useCreateBatch();
  const updateFlavor = useUpdateFlavorInventory();
  const recordWaste = useRecordWaste();

  const submitBatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    createBatch.mutate({
      flavorId: String(data.get("flavorId")), batchCode: String(data.get("batchCode")), portions: Number(data.get("portions")),
      producedAt: String(data.get("producedAt")), expiresAt: String(data.get("expiresAt"))
    }, { onSuccess: () => { toast.success("สร้าง Batch และเพิ่มสต็อกแล้ว"); form.reset(); }, onError: (error) => toast.error(error.message) });
  };

  const submitWaste = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    recordWaste.mutate({ batchId: String(data.get("batchId")), portions: Number(data.get("portions")), reason: String(data.get("reason")) }, {
      onSuccess: () => { toast.success("บันทึกของเสียและตัดสต็อกแล้ว"); form.reset(); }, onError: (error) => toast.error(error.message)
    });
  };

  if (inventory.isLoading) return <main className="grid min-h-[70vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
  if (inventory.isError || !inventory.data) return <main className="mx-auto max-w-xl p-10 text-center"><h1 className="text-2xl font-bold">โหลดคลังสินค้าไม่สำเร็จ</h1><Button className="mt-5" onClick={() => void inventory.refetch()}>RETRY</Button></main>;

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
              BATCH & INVENTORY
            </h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[#631c31]">
              สร้าง Batch ปรับสต็อก จัดการสารก่อภูมิแพ้ และบันทึกของเสีย
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
            className="h-32 w-32 object-contain sm:h-44 sm:w-44"
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-8">

      <section className="mt-8 grid gap-5 lg:grid-cols-3" aria-label="Catalog inventory">
        {inventory.data.flavors.map((flavor) => (
          <Card key={flavor.id} className="border border-black/15 bg-[#21171c] p-5 text-[#fff7ed] shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] uppercase tracking-widest text-white/45">Catalog item</p><h2 className="mt-1 text-lg font-semibold uppercase">{flavor.name}</h2></div>
              <span className="bg-[#f79bad] px-2.5 py-1 font-mono text-xs font-bold text-black">{flavor.availablePortions}</span>
            </div>
            <form className="mt-5" onSubmit={(event) => {
              event.preventDefault(); const data = new FormData(event.currentTarget);
              updateFlavor.mutate({ flavorId: flavor.id, availablePortions: Number(data.get("stock")), allergens: String(data.get("allergens")).split(",") }, {
                onSuccess: () => toast.success(`อัปเดต ${flavor.name} แล้ว`), onError: (error) => toast.error(error.message)
              });
            }}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/50">Available portions</label>
              <input name="stock" type="number" min="0" step="1" defaultValue={flavor.availablePortions} className="mt-2 h-10 w-full border border-white/20 bg-white/5 px-3 outline-none focus:border-[#f79bad]" />
              <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest text-white/50">Allergens · comma separated</label>
              <input name="allergens" defaultValue={flavor.allergens.join(", ")} className="mt-2 h-10 w-full border border-white/20 bg-white/5 px-3 outline-none focus:border-[#f79bad]" />
              <Button type="submit" className="mt-4 h-10 w-full" disabled={updateFlavor.isPending}><Save className="h-3.5 w-3.5" /> SAVE ITEM</Button>
            </form>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-2">
        <form onSubmit={submitBatch} className="border border-black bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3"><PackagePlus className="h-6 w-6 text-[#c14f76]" /><h2 className="text-xl font-bold uppercase tracking-wide">Create New Batch</h2></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-[10px] font-bold uppercase tracking-widest">Flavor<select name="flavorId" required className={fieldClass}>{inventory.data.flavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name}</option>)}</select></label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Batch code<input name="batchCode" required placeholder="GLT-2608-04" className={fieldClass} /></label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Portions<input name="portions" required type="number" min="1" step="1" className={fieldClass} /></label>
            <span />
            <label className="text-[10px] font-bold uppercase tracking-widest">Produced date<input name="producedAt" required type="date" defaultValue="2026-08-17" className={fieldClass} /></label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Expiry date<input name="expiresAt" required type="date" defaultValue="2026-08-24" className={fieldClass} /></label>
          </div>
          <Button type="submit" className="mt-6 w-full" disabled={createBatch.isPending}>{createBatch.isPending && <Loader2 className="h-4 w-4 animate-spin" />} CREATE BATCH & ADD STOCK</Button>
        </form>

        <form onSubmit={submitWaste} className="border border-black bg-[#fff3f7] p-6 sm:p-8">
          <div className="flex items-center gap-3"><Trash2 className="h-6 w-6 text-[#c14f76]" /><h2 className="text-xl font-bold uppercase tracking-wide">Record Waste</h2></div>
          <label className="mt-6 block text-[10px] font-bold uppercase tracking-widest">Batch<select name="batchId" required className={fieldClass}>{inventory.data.batches.filter((batch) => batch.remainingPortions > 0).map((batch) => <option key={batch.id} value={batch.id}>{batch.batchCode} · {batch.flavorName} · {batch.remainingPortions} left</option>)}</select></label>
          <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest">Waste portions<input name="portions" required type="number" min="1" step="1" className={fieldClass} /></label>
          <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest">Reason<input name="reason" required placeholder="Melted / quality control / expired" className={fieldClass} /></label>
          <Button type="submit" variant="secondary" className="mt-6 w-full" disabled={recordWaste.isPending}>{recordWaste.isPending && <Loader2 className="h-4 w-4 animate-spin" />} RECORD WASTE</Button>
        </form>
      </section>

      <section className="mt-8 border border-black bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3"><Boxes className="h-6 w-6" /><h2 className="text-xl font-bold uppercase tracking-wide">Active Batches</h2></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="border-b border-black text-[10px] uppercase tracking-widest"><tr><th className="py-3">Batch</th><th>Flavor</th><th>Produced</th><th>Expires</th><th className="text-right">Remaining</th></tr></thead><tbody>{inventory.data.batches.map((batch) => <tr key={batch.id} className="border-b border-black/10"><td className="py-4 font-mono font-bold">{batch.batchCode}</td><td>{batch.flavorName}</td><td>{batch.producedAt}</td><td>{batch.expiresAt}</td><td className="text-right font-mono font-bold">{batch.remainingPortions} / {batch.initialPortions}</td></tr>)}</tbody></table></div>
      </section>
      </div>
    </main>
  );
}
