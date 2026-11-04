"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import cookieMascot from "@/public/cookie-mascot.png";

const CONSENT_KEY = "gelatte-cookie-consent";
type ConsentChoice = "all" | "necessary";

export function CookieConsent() {
  const [consent, setConsent] = useState<ConsentChoice | null | undefined>(undefined);

  useEffect(() => {
    const readConsent = () => setConsent(localStorage.getItem(CONSENT_KEY) as ConsentChoice | null);
    const timer = window.setTimeout(readConsent, 0);
    window.addEventListener("storage", readConsent);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", readConsent);
    };
  }, []);

  const saveConsent = (choice: ConsentChoice) => {
    localStorage.setItem(CONSENT_KEY, choice);
    setConsent(choice);
  };

  if (consent !== null) return null;

  return (
    <aside
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-[24rem] rounded-3xl border border-line bg-white p-5 shadow-float sm:left-auto sm:right-6 sm:mx-0"
    >
      <div className="flex items-center gap-3.5">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-pink-soft" aria-hidden="true">
          <Image src={cookieMascot} alt="" fill sizes="72px" className="object-contain" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pink-strong">A little heads-up</p>
          <h2 id="cookie-consent-title" className="mt-0.5 text-[17px] font-semibold">Cookies &amp; Gelato</h2>
          <p id="cookie-consent-description" className="mt-0.5 text-[13px] leading-relaxed text-subtle">
            เราใช้คุกกี้ที่จำเป็นเพื่อจดจำการตั้งค่า และช่วยให้เว็บไซต์ทำงานได้ราบรื่น
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Button variant="outline" size="sm" className="h-12" onClick={() => saveConsent("necessary")}>
          เฉพาะที่จำเป็น
        </Button>
        <Button size="sm" className="h-12" onClick={() => saveConsent("all")}>
          ยอมรับทั้งหมด
        </Button>
      </div>
    </aside>
  );
}
