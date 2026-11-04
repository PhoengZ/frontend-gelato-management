"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { Stepper } from "@/components/ui/stepper";
import { allergenLabels, cn, flavorTint, formatMinor } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";
import type { MenuFlavor } from "@/types";

const mockOrigins: Record<string, string> = {
  pistachio: "Italy",
  strawberry: "France",
  vanilla: "Madagascar"
};

const FALLBACK_IMAGE = "/hero/3.png";

function originFor(name: string) {
  const key = Object.keys(mockOrigins).find((flavor) => name.toLowerCase().includes(flavor));
  return key ? mockOrigins[key] : "Italy";
}

/** Mobile flavor row (Figma: FlavorCard — Default / In bag / Sold out). */
export function FlavorCard({ flavor }: { flavor: MenuFlavor }) {
  const item = useCartStore((state) => state.items.find((entry) => entry.flavorId === flavor.id));
  const addItem = useCartStore((state) => state.addItem);
  const updatePortion = useCartStore((state) => state.updatePortion);
  const unavailable = !flavor.active || flavor.available_portions === 0;
  const atLimit = (item?.portions ?? 0) >= flavor.available_portions;

  return (
    <article
      className={cn(
        "flex items-center gap-3.5 rounded-3xl border bg-white p-3 transition-colors",
        item ? "border-ink" : "border-line"
      )}
    >
      <div className={cn("relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl", flavorTint(flavor.name), unavailable && "opacity-45")}>
        <Image
          src={flavor.image_url ?? FALLBACK_IMAGE}
          alt={`เจลาโตรส ${flavor.name}`}
          fill
          sizes="104px"
          className={cn("object-contain", unavailable && "grayscale")}
          // Catalog stores absolute image URLs on any host, so they bypass the optimizer.
          unoptimized={Boolean(flavor.image_url)}
        />
      </div>

      <div className="min-w-0 flex-1">
        <h2 className={cn("truncate text-[17px] font-semibold", unavailable && "text-subtle")}>{flavor.name}</h2>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-subtle">{flavor.description}</p>
        <p className="mt-1 truncate text-xs font-medium text-subtle">
          {originFor(flavor.name)} · เหลือ {flavor.available_portions} สกู๊ป
        </p>
        {flavor.allergens.length > 0 && (
          <p className="truncate text-xs text-subtle">มีส่วนผสม: {flavor.allergens.map((allergen) => allergenLabels[allergen]).join(" · ")}</p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className={cn("text-[17px] font-semibold tabular-nums", unavailable && "text-subtle")}>{formatMinor(flavor.price.amount_minor)}</p>
          {unavailable ? (
            <button type="button" disabled className="inline-flex h-7 items-center gap-1.5 rounded-full bg-line px-3 text-xs font-medium text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />
              หมดแล้ว
            </button>
          ) : item ? (
            <Stepper
              value={item.portions}
              label={flavor.name}
              onDecrement={() => updatePortion(flavor.id, item.portions - 1)}
              onIncrement={() => addItem(flavor)}
              incrementDisabled={atLimit}
            />
          ) : (
            <button
              type="button"
              onClick={() => addItem(flavor)}
              className="grid h-9 w-9 place-items-center rounded-full bg-ink text-canvas transition-transform active:scale-95"
              aria-label={`เพิ่ม ${flavor.name} ลงตะกร้า`}
            >
              <Plus className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
