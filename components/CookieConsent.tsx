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
      className="fixed inset-x-4 bottom-4 z-[70] border border-black bg-[#fffaf2] p-4 shadow-[8px_8px_0_#111] sm:left-auto sm:right-6 sm:max-w-md sm:p-5"
    >
      <div className="flex items-start gap-4">
        <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28" aria-hidden="true">
          <Image src={cookieMascot} alt="" fill sizes="112px" className="object-contain" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d94670]">A little heads-up</p>
          <h2 id="cookie-consent-title" className="mt-1 font-serif text-2xl font-bold italic leading-none text-black">
            Cookies &amp; Gelato
          </h2>
          <p id="cookie-consent-description" className="mt-2 text-xs leading-relaxed text-black/65">
            เราใช้คุกกี้ที่จำเป็นเพื่อจดจำการตั้งค่าและช่วยให้เว็บไซต์ทำงานได้ราบรื่น
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="outline" size="sm" onClick={() => saveConsent("necessary")}>
          เฉพาะที่จำเป็น
        </Button>
        <Button size="sm" onClick={() => saveConsent("all")}>
          ยอมรับทั้งหมด
        </Button>
      </div>
    </aside>
  );
}
