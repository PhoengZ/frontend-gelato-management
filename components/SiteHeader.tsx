"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthNav } from "@/components/auth/AuthNav";
import { CustomerNotification } from "@/components/CustomerNotification";
import logo from "@/public/logo.png";

export function SiteHeader() {
  const pathname = usePathname();
  if (["/staff", "/manager", "/analytics"].some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:h-20 sm:px-6">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-85" aria-label="Gelatte หน้าแรก">
          <Image src={logo} alt="Gelatte Logo" width={220} height={60} priority className="h-9 w-auto bg-transparent object-contain sm:h-12" />
        </Link>
        <nav className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-black/70 sm:gap-4 sm:text-xs">
          <Link href="/#collection" className="hidden transition-colors hover:text-black hover:underline sm:inline underline-offset-8">COLLECTION</Link>
          <CustomerNotification />
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}
