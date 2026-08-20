"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BarChart3, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAnalytics } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import pistachioHero from "@/public/hero/1.png";

function SalesTrendChart({ trend }: { trend: Array<{ date: string; label: string; revenue: number; orders: number }> }) {
  const width = 720;
  const height = 250;
  const padding = { left: 42, right: 20, top: 22, bottom: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxRevenue = Math.max(1, ...trend.map((item) => item.revenue));
  const x = (index: number) => padding.left + (chartWidth * index) / Math.max(1, trend.length - 1);
  const y = (revenue: number) => padding.top + chartHeight - (revenue / maxRevenue) * chartHeight;
  const points = trend.map((item, index) => `${x(index)},${y(item.revenue)}`).join(" ");
  const areaPoints = `${padding.left},${padding.top + chartHeight} ${points} ${padding.left + chartWidth},${padding.top + chartHeight}`;

  return (
    <div className="mt-6 overflow-x-auto" role="img" aria-label="กราฟรายได้ย้อนหลัง 7 วัน">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px]" aria-hidden="true">
        <defs><linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f79bad" stopOpacity="0.55" /><stop offset="1" stopColor="#f79bad" stopOpacity="0.04" /></linearGradient></defs>
        {[0, 0.5, 1].map((ratio) => {
          const gridY = padding.top + chartHeight * ratio;
          return <g key={ratio}><line x1={padding.left} x2={padding.left + chartWidth} y1={gridY} y2={gridY} stroke="rgba(0,0,0,.12)" strokeDasharray="4 5" /><text x={padding.left - 8} y={gridY + 4} textAnchor="end" fontSize="9" fill="rgba(0,0,0,.5)">{Math.round(maxRevenue * (1 - ratio))}</text></g>;
        })}
        <polygon points={areaPoints} fill="url(#sales-area)" />
        <polyline points={points} fill="none" stroke="#171717" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {trend.map((item, index) => (
          <g key={item.date}>
            <circle cx={x(index)} cy={y(item.revenue)} r="5" fill="#f79bad" stroke="#171717" strokeWidth="2"><title>{item.label}: {formatPrice(item.revenue)} · {item.orders} orders</title></circle>
            <text x={x(index)} y={height - 14} textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(0,0,0,.65)">{item.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function AnalyticsPage() {
  const analytics = useAnalytics();
  if (analytics.isLoading) return <main className="grid min-h-[70vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
  if (analytics.isError || !analytics.data) return <main className="mx-auto max-w-xl p-12 text-center"><h1 className="text-2xl font-bold">โหลดรายงานไม่สำเร็จ</h1><Button className="mt-5" onClick={() => void analytics.refetch()}>RETRY</Button></main>;
  const data = analytics.data;
  const maxSales = Math.max(1, ...data.salesByFlavor.map((item) => item.portions));
  const maxWaste = Math.max(1, ...data.wasteByFlavor.map((item) => item.portions));
  const metrics = [
    ["Gross sales", formatPrice(data.totalRevenue)], ["Orders", String(data.totalOrders)], ["Scoops sold", String(data.totalScoops)], ["Waste portions", String(data.totalWaste)]
  ];
  const averageOrder = data.totalOrders ? data.totalRevenue / data.totalOrders : 0;
  const averageScoops = data.totalOrders ? data.totalScoops / data.totalOrders : 0;
  const wasteRate = data.totalScoops + data.totalWaste ? (data.totalWaste / (data.totalScoops + data.totalWaste)) * 100 : 0;

  return (
    <main className="w-full pb-24">
      {/* Pink Hero Banner for Analytics Header - Full Width */}
      <div className="relative w-full overflow-hidden border-b border-black bg-[#f79bad] px-6 py-8 sm:px-10 sm:py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 border border-black bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black">
              MANAGER ANALYTICS
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-[#32111c] sm:text-5xl">
              SALES & WASTE
            </h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[#631c31]">
              ภาพรวมยอดขายและ Waste Trends จากข้อมูลปัจจุบัน
            </p>
          </div>
          <div className="relative z-10 flex gap-3">
            <Button asChild variant="outline" className="border-black bg-white text-black hover:bg-stone-100">
              <Link href="/manager"><ArrowLeft className="mr-2 h-4 w-4" /> INVENTORY</Link>
            </Button>
            <Button
              className="border-black bg-black text-white hover:bg-stone-800"
              onClick={() => void analytics.refetch()}
              disabled={analytics.isFetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${analytics.isFetching ? "animate-spin" : ""}`} /> REFRESH
            </Button>
          </div>
        </div>

        {/* Overlayed Gelato Image */}
        <div className="pointer-events-none absolute -bottom-6 right-4 z-0 sm:right-16 md:right-28">
          <Image
            src={pistachioHero}
            alt="Pistachio gelato"
            width={176}
            height={176}
            className="h-32 w-32 object-contain sm:h-44 sm:w-44"
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(([label, value], index) => (
            <Card key={label} className={`${index === 3 ? "bg-[#f79bad]" : "bg-white text-black"} border border-black p-6 shadow-none`}>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
              <p className="mt-3 font-mono text-3xl font-bold">{value}</p>
            </Card>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          <Card className="border border-black bg-white p-6 shadow-none sm:p-8">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-[#c14f76]" /><div><h2 className="text-lg font-bold uppercase tracking-wide">7-day revenue trend</h2><p className="mt-1 text-xs text-black/45">รายได้รวมรายวัน · บาท</p></div></div>
              <span className="border border-black bg-[#fff3f7] px-3 py-1.5 font-mono text-xs font-bold">{formatPrice(data.salesTrend.reduce((sum, day) => sum + day.revenue, 0))}</span>
            </div>
            <SalesTrendChart trend={data.salesTrend} />
          </Card>

          <Card className="border border-black bg-[#21171c] p-6 text-white shadow-none sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f79bad]">Performance statistics</p>
            <h2 className="mt-2 text-lg font-bold uppercase tracking-wide">Store efficiency</h2>
            <dl className="mt-6 divide-y divide-white/15">
              <div className="flex items-end justify-between py-4"><dt className="text-xs uppercase tracking-wider text-white/55">Avg. order value</dt><dd className="font-mono text-xl font-bold">{formatPrice(averageOrder)}</dd></div>
              <div className="flex items-end justify-between py-4"><dt className="text-xs uppercase tracking-wider text-white/55">Scoops / order</dt><dd className="font-mono text-xl font-bold">{averageScoops.toFixed(1)}</dd></div>
              <div className="flex items-end justify-between py-4"><dt className="text-xs uppercase tracking-wider text-white/55">Waste rate</dt><dd className="font-mono text-xl font-bold text-[#f79bad]">{wasteRate.toFixed(1)}%</dd></div>
              <div className="flex items-end justify-between py-4"><dt className="text-xs uppercase tracking-wider text-white/55">Active sales days</dt><dd className="font-mono text-xl font-bold">{data.salesTrend.filter((day) => day.orders > 0).length} / 7</dd></div>
            </dl>
          </Card>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-2">
          <Card className="border border-black bg-white p-6 shadow-none sm:p-8">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-[#c14f76]" />
              <h2 className="text-lg font-bold uppercase tracking-wide">Sales by flavor</h2>
            </div>
            <div className="mt-8 space-y-6">
              {data.salesByFlavor.map((item) => (
                <div key={item.flavorId}>
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="font-bold uppercase">{item.flavorName}</span>
                    <span className="font-mono">{item.portions} · {formatPrice(item.revenue)}</span>
                  </div>
                  <div className="mt-2 h-3 bg-black/10">
                    <div className="h-full bg-black" style={{ width: `${(item.portions / maxSales) * 100}%` }} />
                  </div>
                </div>
              ))}
              {!data.salesByFlavor.length && <p className="py-12 text-center text-sm text-black/45">ยังไม่มีข้อมูลยอดขาย</p>}
            </div>
          </Card>
          <Card className="border border-black bg-[#fff3f7] p-6 shadow-none sm:p-8">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-[#c14f76]" />
              <h2 className="text-lg font-bold uppercase tracking-wide">Waste trends</h2>
            </div>
            <div className="mt-8 space-y-6">
              {data.wasteByFlavor.map((item) => (
                <div key={item.flavorId}>
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="font-bold uppercase">{item.flavorName}</span>
                    <span className="font-mono">{item.portions} portions</span>
                  </div>
                  <div className="mt-2 h-3 bg-black/10">
                    <div className="h-full bg-[#e66f98]" style={{ width: `${(item.portions / maxWaste) * 100}%` }} />
                  </div>
                </div>
              ))}
              {!data.wasteByFlavor.length && <p className="py-12 text-center text-sm text-black/45">ยังไม่มีการบันทึกของเสีย</p>}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
