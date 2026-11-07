"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Boxes, ChefHat, LogOut, ShieldCheck, Store } from "lucide-react";
import { NotificationBell } from "@/components/CustomerNotification";
import { useLogout, useSession } from "@/lib/api";
import { cn } from "@/lib/utils";
import logo from "@/public/logo.png";

const baseItems = [{ href: "/staff", label: "ครัว", description: "ออเดอร์และคิว", icon: ChefHat }];
const BACKOFFICE_ROLES = ["STAFF", "MANAGER"] as const;
const BELL_LABEL = "แจ้งเตือนสต็อก";

const managerItems = [
  { href: "/manager", label: "เมนูและคลังสินค้า", description: "เมนู · Batch · ของเสีย", icon: Boxes },
  { href: "/analytics", label: "รายงาน", description: "ยอดขายและของเสีย", icon: BarChart3 }
];

/** Desktop backoffice layout (Figma: Sidebar) with a compact top bar below md. */
export function BackofficeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const logout = useLogout();
  const user = session.data;
  const items = user?.role === "MANAGER" ? [...baseItems, ...managerItems] : baseItems;

  const logoutNow = () => logout.mutate(undefined, { onSuccess: () => { router.push("/login"); router.refresh(); } });

  return (
    <div className="min-h-screen bg-canvas md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-7 border-r border-line bg-white px-4 pb-5 pt-6 md:flex">
        <div className="space-y-2.5 px-2">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" aria-label="Gelatte home">
              <Image src={logo} alt="Gelatte" priority className="h-9 w-auto" />
            </Link>
            <NotificationBell roles={[...BACKOFFICE_ROLES]} label={BELL_LABEL} />
          </div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            <ShieldCheck className="h-3.5 w-3.5" /> Backoffice
          </p>
        </div>

        <nav className="flex-1 space-y-1" aria-label="Backoffice navigation">
          {items.map(({ href, label, description, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors", active ? "bg-ink text-canvas" : "text-ink hover:bg-canvas")}
              >
                <Icon className={cn("h-5 w-5 shrink-0", !active && "text-subtle")} strokeWidth={1.75} />
                <span>
                  <span className={cn("block text-sm", active && "font-semibold")}>{label}</span>
                  <span className={cn("block text-xs", active ? "text-canvas/65" : "text-subtle")}>{description}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1">
          <div className="flex items-center gap-2.5 rounded-2xl bg-canvas p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink text-sm font-semibold">{user?.display_name.slice(0, 1) ?? "·"}</span>
            <div className="min-w-0">
              <p className="truncate text-sm">{user?.display_name ?? "กำลังโหลดบัญชี…"}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">{user?.role ?? "Secure session"}</p>
            </div>
          </div>
          <button type="button" onClick={logoutNow} disabled={logout.isPending} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-subtle hover:bg-canvas hover:text-ink disabled:opacity-40">
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} /> ออกจากระบบ
          </button>
          <Link href="/" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-subtle hover:bg-canvas hover:text-ink">
            <Store className="h-[18px] w-[18px]" strokeWidth={1.75} /> ไปหน้าร้าน
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-line bg-white px-4 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <Image src={logo} alt="Gelatte" className="h-8 w-auto" />
            <div className="flex items-center gap-1">
              <NotificationBell roles={[...BACKOFFICE_ROLES]} label={BELL_LABEL} />
              <button onClick={logoutNow} className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink/5" aria-label="ออกจากระบบ">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn("flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm", pathname === href ? "bg-ink text-canvas" : "border border-line bg-white")}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
