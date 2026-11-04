import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import { CookieConsent } from "@/components/CookieConsent";
import { SiteHeader } from "@/components/SiteHeader";
import { Providers } from "@/components/providers";
import "./globals.css";

const anuphan = Anuphan({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-anuphan",
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

export const viewport: Viewport = {
  themeColor: "#FFFAF4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={anuphan.variable}>
      <body className="font-sans antialiased">
        <Providers>
          <SiteHeader />
          {children}
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
