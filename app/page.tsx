"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FlavorCard } from "@/components/FlavorCard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalog } from "@/lib/api";
import { cn, formatPrice } from "@/lib/utils";
import pistachioHero from "@/public/hero/1.png";
import strawberryHero from "@/public/hero/2.png";
import vanillaHero from "@/public/hero/3.png";
import heroTitle from "@/public/hero/title.png";
import gelatoLineup from "@/public/hero/gelato-lineup.png";
import { useCartStore } from "@/store/useCartStore";

export default function MenuPage() {
  const catalog = useCatalog();
  const items = useCartStore((state) => state.items);
  const itemCount = items.reduce((total, item) => total + item.portions, 0);
  const total = items.reduce((sum, item) => sum + item.portions * item.unitPrice, 0);

  return (
    <main>
      <section className="gelato-hero relative isolate min-h-[calc(100svh-4rem)] overflow-hidden border-b border-black sm:min-h-[calc(100svh-5rem)]" aria-labelledby="hero-heading">
        <div className="relative z-30 mx-auto flex min-h-[calc(100svh-4rem)] max-w-[100rem] flex-col items-center px-4 pb-6 pt-8 sm:min-h-[calc(100svh-5rem)] sm:px-8 sm:pt-10 lg:pt-5">
          <div className="flex w-full flex-col items-center text-center">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.32em] text-black sm:text-xs">
              Handcrafted daily · Bangkok
            </p>
            <h1 id="hero-heading" className="relative w-[96vw] max-w-[72rem] sm:w-[88vw] xl:w-[76vw]">
              <Image src={heroTitle} alt="Have Fun With Gelato" className="h-auto w-full object-contain" preload />
            </h1>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[22%] z-10 sm:top-[30%]" aria-hidden="true">
            <div className="absolute bottom-[20%] -left-[18%] aspect-square w-[62vw] max-w-[46rem] -rotate-[12deg] sm:-bottom-[30%] sm:-left-[9%] sm:w-[51vw] md:-left-[5%] md:w-[46vw] xl:-bottom-[43%] xl:left-[2%] xl:w-[39vw]">
              <Image src={pistachioHero} alt="" fill sizes="(max-width: 640px) 65vw, 42vw" className="object-contain" />
            </div>
            <div className="absolute bottom-[22%] left-1/2 z-20 aspect-square w-[76vw] max-w-[48rem] -translate-x-1/2 sm:-bottom-[30%] sm:w-[57vw] md:w-[49vw] xl:-bottom-[47%] xl:w-[40vw]">
              <Image src={strawberryHero} alt="" fill sizes="(max-width: 640px) 79vw, 45vw" className="object-contain" preload />
            </div>
            <div className="absolute bottom-[19%] -right-[19%] aspect-square w-[62vw] max-w-[46rem] rotate-[11deg] sm:-bottom-[30%] sm:-right-[9%] sm:w-[51vw] md:-right-[5%] md:w-[46vw] xl:-bottom-[43%] xl:right-[1%] xl:w-[39vw]">
              <Image src={vanillaHero} alt="" fill sizes="(max-width: 640px) 65vw, 42vw" className="object-contain" />
            </div>
          </div>

          <div className="absolute bottom-5 left-4 right-4 z-40 sm:bottom-7 sm:left-auto sm:right-8">
            <Link href="#collection" className={cn(buttonVariants({ size: "lg" }), "group h-auto w-full justify-between px-5 py-4 sm:w-auto sm:px-6 sm:py-5")}>
              Shop the collection
              <ArrowDownRight className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:translate-y-1" />
            </Link>
          </div>
        </div>
      </section>

      <section id="collection" className="mx-auto max-w-7xl scroll-mt-24 px-6 pt-16 sm:pt-24" aria-label="Gelato Collection">
        {catalog.isLoading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3" aria-label="กำลังโหลดเมนู">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[34rem] rounded-none bg-stone-200" />
            ))}
          </div>
        ) : catalog.isError ? (
          <section className="border border-black bg-white p-12 text-center shadow-2xl">
            <h2 className="text-2xl font-bold uppercase tracking-wider">UNABLE TO LOAD CATALOG</h2>
            <p className="mt-2 text-sm text-black/60">กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง</p>
            <Button className="mt-6 px-8 py-3" onClick={() => void catalog.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> RETRY CONNECTION
            </Button>
          </section>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.data?.map((flavor) => <FlavorCard key={flavor.id} flavor={flavor} />)}
          </div>
        )}
      </section>

      <section className="mt-16 overflow-hidden sm:mt-24" aria-label="Gelato selection">
        <Image
          src={gelatoLineup}
          alt="Gelato ทั้งสามรสของ Gelatte"
          className="h-auto w-full"
          sizes="100vw"
        />
      </section>

      <AnimatePresence>
        {itemCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-x-0 bottom-8 z-40 mx-auto w-[calc(100%-3rem)] max-w-xl"
          >
            <Button asChild size="lg" className="h-16 w-full justify-between px-6">
              <Link href="/cart">
                <span className="flex items-center gap-4 text-xs uppercase tracking-widest font-bold">
                  <span className="flex h-7 w-7 items-center justify-center bg-white text-black font-mono font-black text-xs">
                    {itemCount}
                  </span>
                  MY BAG · {itemCount} ITEMS
                </span>
                <span className="flex items-center gap-3 font-mono text-sm font-bold">
                  {formatPrice(total)} 
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
