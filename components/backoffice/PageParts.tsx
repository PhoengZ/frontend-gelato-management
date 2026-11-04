import { cn } from "@/lib/utils";

/** Desktop page title block with right-aligned actions. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: React.ReactNode; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {eyebrow}
        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
        <p className="text-[15px] text-subtle">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function Eyebrow({ children, live = false }: { children: React.ReactNode; live?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-pink-soft px-3 py-1 text-xs font-medium">
      {live && <span className="h-2 w-2 animate-pulse rounded-full bg-pink-strong" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Figma: MetricTile — Default / Pink / Ink. */
export function StatTile({ label, value, note, tone = "default" }: { label: string; value: string; note?: string; tone?: "default" | "pink" | "ink" }) {
  return (
    <div className={cn("rounded-3xl p-4", tone === "pink" ? "bg-pink-soft" : tone === "ink" ? "bg-ink text-canvas" : "border border-line bg-white")}>
      <p className={cn("text-xs", tone === "ink" ? "text-canvas/70" : "text-subtle")}>{label}</p>
      <p className="mt-1.5 text-[26px] font-bold tabular-nums leading-tight">{value}</p>
      {note && <p className={cn("mt-1 text-xs", tone === "ink" ? "text-canvas/70" : "text-subtle")}>{note}</p>}
    </div>
  );
}

export function Panel({ title, description, icon, actions, className, children }: { title: string; description?: string; icon?: React.ReactNode; actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-3xl border border-line bg-white p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink-soft">{icon}</span>}
          <div>
            <h2 className="text-[17px] font-semibold">{title}</h2>
            {description && <p className="text-[13px] text-subtle">{description}</p>}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
