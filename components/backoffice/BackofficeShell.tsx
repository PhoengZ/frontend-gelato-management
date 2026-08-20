"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Boxes, ChefHat, Home, LogOut, ShieldCheck } from "lucide-react";
import { useLogout, useSession } from "@/lib/api";
import { cn } from "@/lib/utils";
import logo from "@/public/logo.png";

const baseItems = [{ href: "/staff", label: "Fulfillment", description: "Orders & queue", icon: ChefHat }];
const managerItems = [
  { href: "/manager", label: "Menu & Inventory", description: "Catalog & batches", icon: Boxes },
  { href: "/analytics", label: "Analytics", description: "Sales & waste", icon: BarChart3 }
];

export function BackofficeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const logout = useLogout();
  const user = session.data?.user;
  const items = user?.role === "MANAGER" ? [...baseItems, ...managerItems] : baseItems;

  const logoutNow = () => logout.mutate(undefined, { onSuccess: () => { router.push("/login"); router.refresh(); } });

  return (
    <div className="font-prompt min-h-screen bg-stone-50 md:grid md:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-black/10 bg-white text-black md:flex">
        <div className="border-b border-black/10 px-6 py-6">
          <Link href="/" aria-label="Gelatte home">
            <Image src={logo} alt="Gelatte" width={220} height={60} priority className="h-10 w-auto object-contain" />
          </Link>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-black/60">
            <ShieldCheck className="h-3.5 w-3.5 text-black" /> BACKOFFICE PORTAL
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 p-4" aria-label="Backoffice navigation">
          {items.map(({ href, label, description, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 border px-3.5 py-3 transition-all",
                  active
                    ? "border-black bg-black text-white"
                    : "border-transparent text-black/70 hover:border-black/20 hover:bg-stone-50 hover:text-black"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wider">{label}</span>
                  <span className={cn("mt-0.5 block text-[9px] uppercase tracking-widest", active ? "text-white/70" : "text-black/40")}>
                    {description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-black/10 p-4">
          <div className="px-2 pb-3">
            <p className="truncate text-xs font-bold text-black">{user?.name ?? "Loading account..."}</p>
            <p className="mt-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-black/50">{user?.role ?? "SECURE SESSION"}</p>
          </div>
          <button
            type="button"
            onClick={logoutNow}
            disabled={logout.isPending}
            className="flex w-full items-center gap-2.5 border border-black/15 bg-white px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-black transition-colors hover:border-black hover:bg-stone-100 disabled:opacity-40"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
          <Link href="/" className="mt-2 flex items-center gap-2 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-black/50 hover:text-black">
            <Home className="h-3.5 w-3.5" /> Storefront
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-50 border-b border-black/10 bg-white px-4 py-3 text-black md:hidden">
          <div className="flex items-center justify-between">
            <Image src={logo} alt="Gelatte" width={160} height={44} className="h-8 w-auto object-contain" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-black/60">{user?.role ?? "BACKOFFICE"}</span>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-2 border px-3 py-2 text-[9px] font-bold uppercase tracking-wider",
                  pathname === href ? "border-black bg-black text-white" : "border-black/15 bg-white text-black/70"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
            <button onClick={logoutNow} className="ml-auto flex shrink-0 items-center border border-black/15 bg-white px-3 text-black" aria-label="Logout">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
