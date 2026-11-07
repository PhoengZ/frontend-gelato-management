"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Loader2, RefreshCw, TrendingUp, Trash2 } from "lucide-react";
import { PageHeader, Panel, StatTile } from "@/components/backoffice/PageParts";
import { StaleNotice, useLoginOnUnauthorized } from "@/components/StaleNotice";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAnalytics } from "@/lib/api";
import { cn, formatPrice } from "@/lib/utils";
import type { AnalyticsPeriod } from "@/types";

const periods: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: "1d", label: "1 วัน" },
  { value: "1w", label: "7 วัน" },
  { value: "1m", label: "30 วัน" },
  { value: "6m", label: "6 เดือน" }
];

/** Lets grid children shrink below their min-content, so only the chart scrolls on a phone. */
const gridItems = "[&>*]:min-w-0";

function SalesTrendChart({ trend }: { trend: Array<{ date: string; label: string; revenue: number; orders: number }> }) {
  const width = 720;
  const height = 260;
  const padding = { left: 48, right: 16, top: 20, bottom: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxRevenue = Math.max(1, ...trend.map((item) => item.revenue));
  const x = (index: number) => padding.left + (chartWidth * index) / Math.max(1, trend.length - 1);
  const y = (revenue: number) => padding.top + chartHeight - (revenue / maxRevenue) * chartHeight;
  const points = trend.map((item, index) => `${x(index)},${y(item.revenue)}`).join(" ");
  const areaPoints = `${padding.left},${padding.top + chartHeight} ${points} ${padding.left + chartWidth},${padding.top + chartHeight}`;
  // Thin out x labels on long periods so they never collide.
  const labelEvery = Math.max(1, Math.ceil(trend.length / 8));

  return (
    <div className="overflow-x-auto" role="img" aria-label="กราฟรายได้ย้อนหลัง">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[560px]" aria-hidden="true">
        <defs>
          <linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#F88397" stopOpacity="0.35" />
            <stop offset="1" stopColor="#F88397" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const gridY = padding.top + chartHeight * ratio;
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={padding.left + chartWidth} y1={gridY} y2={gridY} stroke="#EFE6E2" strokeDasharray={ratio === 1 ? undefined : "4 5"} />
              <text x={padding.left - 10} y={gridY + 4} textAnchor="end" fontSize="11" fill="#6B6266">{Math.round(maxRevenue * (1 - ratio)).toLocaleString("th-TH")}</text>
            </g>
          );
        })}
        <polygon points={areaPoints} fill="url(#sales-area)" />
        <polyline points={points} fill="none" stroke="#141012" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {trend.map((item, index) => (
          <g key={item.date}>
            <circle cx={x(index)} cy={y(item.revenue)} r="4.5" fill="#FFFFFF" stroke="#141012" strokeWidth="2">
              <title>{item.label}: {formatPrice(item.revenue)} · {item.orders} orders</title>
            </circle>
            {index % labelEvery === 0 && <text x={x(index)} y={height - 10} textAnchor="middle" fontSize="11" fill="#6B6266">{item.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

function BarList({ rows, max, color, valueLabel, empty }: { rows: Array<{ id: string; name: string; value: number; detail: string }>; max: number; color: string; valueLabel?: string; empty: string }) {
  if (!rows.length) return <p className="py-12 text-center text-sm text-subtle">{empty}</p>;
  return (
    <ul className="space-y-5">
      {rows.map((row) => (
        <li key={row.id}>
          <div className="flex justify-between gap-4 text-sm">
            <span className="font-medium">{row.name}</span>
            <span className="tabular-nums text-subtle">{row.detail}{valueLabel}</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
            <div className={cn("h-full rounded-full", color)} style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("1w");
  const analytics = useAnalytics(period);
  const redirectingToLogin = useLoginOnUnauthorized(analytics.error);
  const periodLabel = periods.find((item) => item.value === period)?.label ?? period;

  const periodControl = (
    <div className="flex h-12 items-center rounded-full border border-line bg-white p-1" role="radiogroup" aria-label="ช่วงเวลา">
      {periods.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={item.value === period}
          onClick={() => setPeriod(item.value)}
          className={cn("h-10 rounded-full px-4 text-sm transition-colors", item.value === period ? "bg-ink font-semibold text-canvas" : "text-subtle hover:text-ink")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  const header = (
    <PageHeader
      title="ยอดขายและของเสีย"
      description="ภาพรวมยอดขายและแนวโน้มของเสียจากข้อมูลปัจจุบัน"
      actions={
        <>
          {periodControl}
          <Link href="/manager" className={buttonVariants({ variant: "outline" })}><ArrowLeft className="h-4 w-4" /> คลังสินค้า</Link>
          <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => void analytics.refetch()} disabled={analytics.isFetching} aria-label="รีเฟรช">
            <RefreshCw className={cn("h-4 w-4", analytics.isFetching && "animate-spin")} />
          </Button>
        </>
      }
    />
  );

  if (analytics.isLoading || redirectingToLogin) {
    return <main className="mx-auto max-w-[76rem] space-y-7 px-6 pb-12 pt-8 lg:px-10">{header}<div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-pink-strong" /></div></main>;
  }
  if (!analytics.data) {
    return (
      <main className="mx-auto max-w-[76rem] space-y-7 px-6 pb-12 pt-8 lg:px-10">
        {header}
        <section className="flex flex-col items-center rounded-3xl border border-line bg-white px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-pink-soft"><RefreshCw className="h-6 w-6 text-pink-strong" /></span>
          <h2 className="mt-3 text-[17px] font-semibold">โหลดรายงานไม่สำเร็จ</h2>
          <Button className="mt-5 w-40" onClick={() => void analytics.refetch()}>ลองใหม่</Button>
        </section>
      </main>
    );
  }

  const data = analytics.data;
  const maxSales = Math.max(1, ...data.salesByFlavor.map((item) => item.portions));
  const maxWaste = Math.max(1, ...data.wasteByFlavor.map((item) => item.portions));
  const averageOrder = data.totalOrders ? data.totalRevenue / data.totalOrders : 0;
  const averageScoops = data.totalOrders ? data.totalScoops / data.totalOrders : 0;
  const wasteRate = data.totalScoops + data.totalWaste ? (data.totalWaste / (data.totalScoops + data.totalWaste)) * 100 : 0;
  const trendTotal = data.salesTrend.reduce((sum, day) => sum + day.revenue, 0);

  return (
    <main className="mx-auto max-w-[76rem] space-y-7 px-6 pb-12 pt-8 lg:px-10">
      {analytics.isError && <StaleNotice />}
      {header}

      {/* Without an explicit track an implicit grid column grows to its content's min-content. */}
      <section className={cn(gridItems, "grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4")} aria-label="ตัวชี้วัดหลัก">
        <StatTile label="ยอดขายรวม" value={formatPrice(data.totalRevenue)} note={periodLabel} />
        <StatTile label="จำนวนออเดอร์" value={data.totalOrders.toLocaleString("th-TH")} note={`เฉลี่ย ${formatPrice(averageOrder)} / ออเดอร์`} />
        <StatTile label="สกู๊ปที่ขายได้" value={data.totalScoops.toLocaleString("th-TH")} note={`${averageScoops.toFixed(1)} สกู๊ป / ออเดอร์`} />
        <StatTile label="ของเสีย" value={`${data.totalWaste} สกู๊ป`} note={`อัตราของเสีย ${wasteRate.toFixed(1)}%`} tone="pink" />
      </section>

      <section className={cn(gridItems, "grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]")}>
        <Panel
          title={`แนวโน้มรายได้ · ${periodLabel}`}
          description="รายได้รวมรายวัน (บาท)"
          icon={<TrendingUp className="h-5 w-5" />}
          actions={<span className="rounded-full bg-pink-soft px-3 py-1.5 text-sm font-semibold tabular-nums">{formatPrice(trendTotal)}</span>}
        >
          <SalesTrendChart trend={data.salesTrend} />
        </Panel>

        <section className="rounded-3xl bg-ink p-6 text-canvas">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pink">Performance</p>
          <h2 className="mt-1 text-[17px] font-semibold">ประสิทธิภาพร้าน</h2>
          <dl className="mt-4 divide-y divide-canvas/15">
            {[
              ["มูลค่าเฉลี่ยต่อออเดอร์", formatPrice(averageOrder)],
              ["สกู๊ปต่อออเดอร์", averageScoops.toFixed(1)],
              ["อัตราของเสีย", `${wasteRate.toFixed(1)}%`],
              ["วันที่มียอดขาย", `${data.salesTrend.filter((day) => day.orders > 0).length} / ${data.salesTrend.length}`]
            ].map(([label, value], index) => (
              <div key={label} className="flex items-end justify-between py-3.5">
                <dt className="text-sm text-canvas/65">{label}</dt>
                <dd className={cn("text-xl font-semibold tabular-nums", index === 2 && "text-pink")}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </section>

      <section className={cn(gridItems, "grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-2")}>
        <Panel title="ยอดขายตามรสชาติ" description="จำนวนสกู๊ปและรายได้" icon={<BarChart3 className="h-5 w-5" />}>
          <BarList
            rows={data.salesByFlavor.map((item) => ({ id: item.flavorId, name: item.flavorName, value: item.portions, detail: `${item.portions} สกู๊ป · ${formatPrice(item.revenue)}` }))}
            max={maxSales}
            color="bg-ink"
            empty="ยังไม่มีข้อมูลยอดขาย"
          />
        </Panel>
        <Panel title="แนวโน้มของเสีย" description="จำนวนสกู๊ปที่ตัดทิ้งตามรสชาติ" icon={<Trash2 className="h-5 w-5 text-pink-strong" />}>
          <BarList
            rows={data.wasteByFlavor.map((item) => ({ id: item.flavorId, name: item.flavorName, value: item.portions, detail: `${item.portions} สกู๊ป` }))}
            max={maxWaste}
            color="bg-pink"
            empty="ยังไม่มีการบันทึกของเสีย"
          />
        </Panel>
      </section>
    </main>
  );
}
