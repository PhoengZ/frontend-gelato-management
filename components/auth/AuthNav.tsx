"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Boxes, ChefHat, ChevronRight, LogOut, User } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLogout, useSession } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AuthNav() {
  const router = useRouter();
  const session = useSession();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const user = session.data;

  if (!user) {
    return (
      <Link href="/login" className={cn(buttonVariants({ size: "sm" }), "ml-1 h-9 px-4")}>
        เข้าสู่ระบบ
      </Link>
    );
  }

  const links = [
    ...(user.role === "STAFF" || user.role === "MANAGER" ? [{ href: "/staff", label: "ครัว · จัดการออเดอร์", icon: ChefHat }] : []),
    ...(user.role === "MANAGER"
      ? [
          { href: "/manager", label: "เมนูและคลังสินค้า", icon: Boxes },
          { href: "/analytics", label: "รายงานยอดขาย", icon: BarChart3 }
        ]
      : [])
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5" aria-label={`บัญชีของ ${user.display_name}`}>
          <User className="h-[22px] w-[22px]" strokeWidth={1.75} />
        </button>
      </SheetTrigger>
      <SheetContent>
        <div className="flex items-center gap-3 pr-10">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pink text-lg font-semibold">
            {user.display_name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <SheetTitle className="truncate text-[17px]">{user.display_name}</SheetTitle>
            <SheetDescription className="truncate">{user.email} · {user.role}</SheetDescription>
          </div>
        </div>

        {links.length > 0 && (
          <nav className="mt-5 overflow-hidden rounded-2xl border border-line bg-white">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 border-b border-line px-4 py-3.5 text-[15px] last:border-0 hover:bg-canvas">
                <Icon className="h-5 w-5 text-subtle" strokeWidth={1.75} />
                <span className="flex-1">{label}</span>
                <ChevronRight className="h-4 w-4 text-subtle" />
              </Link>
            ))}
          </nav>
        )}

        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSuccess: () => { setOpen(false); router.push("/"); router.refresh(); } })}
          disabled={logout.isPending}
          className={cn(buttonVariants({ variant: "outline" }), "mt-4 w-full")}
        >
          <LogOut className="h-4 w-4" /> ออกจากระบบ
        </button>
      </SheetContent>
    </Sheet>
  );
}
