import type { Metadata } from "next";
import localFont from "next/font/local";
import { Prompt } from "next/font/google";
import { CookieConsent } from "@/components/CookieConsent";
import { SiteHeader } from "@/components/SiteHeader";
import { Providers } from "@/components/providers";
import "./globals.css";

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap"
});

const than = localFont({
  src: [
    { path: "./fonts/Than-Light.otf", weight: "400", style: "normal" },
    { path: "./fonts/Than-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/Than-Extrabold.otf", weight: "800", style: "normal" }
  ],
  variable: "--font-than",
  display: "swap"
});

export const metadata: Metadata = {
  title: "GELATTE — Artisanal Gelato",
  description: "สั่ง Gelato และติดตามคิวแบบเรียลไทม์",
  icons: {
    icon: "/cookie-mascot.png",
    apple: "/cookie-mascot.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${than.variable} ${prompt.variable} antialiased`}>
        <Providers>
          <SiteHeader />
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
