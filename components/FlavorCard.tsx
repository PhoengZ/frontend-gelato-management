"use client";

import Image from "next/image";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";
import type { Flavor } from "@/types";
import bestSellerBadge from "@/public/best-seller.png";
import franceFlag from "@/public/origins/france.png";
import italyFlag from "@/public/origins/italy.png";
import madagascarFlag from "@/public/origins/madagascar.png";

const mockOrigins: Record<string, { country: string; flag: typeof italyFlag }> = {
  pistachio: { country: "Italy", flag: italyFlag },
  strawberry: { country: "France", flag: franceFlag },
  vanilla: { country: "Madagascar", flag: madagascarFlag },
};

export function FlavorCard({ flavor }: { flavor: Flavor }) {
  const item = useCartStore((state) => state.items.find((entry) => entry.flavorId === flavor.id));
  const addItem = useCartStore((state) => state.addItem);
  const updatePortion = useCartStore((state) => state.updatePortion);
  const unavailable = !flavor.isAvailable || flavor.availablePortions === 0;
  const atLimit = (item?.portions ?? 0) >= flavor.availablePortions;
  const origin = mockOrigins[flavor.id] ?? { country: "Italy", flag: italyFlag };

  return (
    <article className="group h-full">
      <Card className="h-full rounded-none border border-[#4f313c] bg-[#21171c] text-[#fff7ed] shadow-none">
        <div className="relative aspect-square overflow-hidden bg-[#f5a6b7] border-b border-[#4f313c]">
          <Image
            src={flavor.imageUrl}
            alt={`เจลาโตรส ${flavor.name}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`object-contain ${unavailable ? "grayscale opacity-60" : ""}`}
            priority={flavor.id === "pistachio"}
          />
          <Image
            src={bestSellerBadge}
            alt="Best Seller"
            width={1000}
            height={1000}
            className="pointer-events-none absolute left-3 top-3 h-auto w-16 opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:left-4 sm:top-4 sm:w-20"
          />
        </div>

        <CardContent className="flex flex-col p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold uppercase tracking-[0.04em] text-[#fff7ed]">{flavor.name}</h2>
            <p className="shrink-0 font-mono text-base font-bold text-[#fff7ed]">{formatPrice(flavor.pricePerPortion)}</p>
          </div>

          <p className="mt-2 h-10 overflow-hidden text-xs leading-5 text-[#fff7ed]/65">{flavor.description}</p>

          <div className="mt-4 flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-[0.12em] text-[#fff7ed]/55">
            <span className="flex items-center gap-2">
              <span
                className="relative flex h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white"
                aria-label={`Origin: ${origin.country}`}
                title={`Origin: ${origin.country}`}
              >
                <Image src={origin.flag} alt="" fill sizes="20px" className="object-cover" />
              </span>
              {origin.country} · Stock {flavor.availablePortions}
            </span>
            <span className="text-right">
              {flavor.allergens.length ? `Contains · ${flavor.allergens.join(" · ")}` : "Allergen free"}
            </span>
          </div>

          <div className="mt-4 border-t border-white/15 pt-4">
            {item ? (
              <div className="flex items-center justify-between border border-[#7f4a5c] bg-[#181015] p-0.5" aria-label={`จำนวน ${flavor.name}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#fff7ed] hover:border-[#f79bad] hover:bg-[#322028]"
                  onClick={() => updatePortion(flavor.id, item.portions - 1)}
                  aria-label={`ลดจำนวน ${flavor.name}`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-16 text-center font-mono text-xs font-bold text-[#fff7ed]">{item.portions} SCOOPS</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#fff7ed] hover:border-[#f79bad] hover:bg-[#322028] disabled:opacity-30"
                  onClick={() => addItem(flavor)}
                  disabled={atLimit}
                  aria-label={`เพิ่มจำนวน ${flavor.name}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button 
                className="h-11 w-full"
                onClick={() => addItem(flavor)} 
                disabled={unavailable}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                {unavailable ? "SOLD OUT" : "ADD TO SELECTION"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </article>
  );
}
