"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AuthNav } from "@/components/auth/AuthNav";
import { CustomerNotification } from "@/components/CustomerNotification";
import logo from "@/public/logo.png";

const BACKOFFICE = ["/staff", "/manager", "/analytics"];

/** Sub-pages get a back header with a centred title instead of the brand header. */
function backHeaderFor(pathname: string): { title: string; href?: string } | null {
  if (pathname === "/cart") return { title: "ตะกร้าของฉัน", href: "/" };
  if (pathname.startsWith("/queue/")) return { title: "คำสั่งซื้อของฉัน", href: "/" };
  if (pathname === "/login" || pathname === "/signup") return { title: "" };
  return null;
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  if (BACKOFFICE.some((prefix) => pathname.startsWith(prefix))) return null;

  const back = backHeaderFor(pathname);
  if (back) {
    const backClass = "grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5";
    return (
      <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-3xl items-center px-2">
          {back.href ? (
            <Link href={back.href} className={backClass} aria-label="ย้อนกลับ">
              <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={1.75} />
            </Link>
          ) : (
            <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))} className={backClass} aria-label="ย้อนกลับ">
              <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={1.75} />
            </button>
          )}
          <p className="flex-1 text-center text-[17px] font-semibold">{back.title}</p>
          <span className="w-10" aria-hidden="true" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-3xl items-center justify-between pl-4 pr-2">
        <Link href="/" className="transition-opacity hover:opacity-80" aria-label="Gelatte หน้าแรก">
          <Image src={logo} alt="Gelatte" priority className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-0.5">
          <CustomerNotification />
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}
