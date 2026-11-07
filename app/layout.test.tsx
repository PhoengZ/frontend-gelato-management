import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RootLayout from "@/app/layout";

vi.mock("next/font/google", () => ({ Anuphan: () => ({ variable: "font" }) }));
vi.mock("@/app/globals.css", () => ({}));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => <header>header</header> }));
vi.mock("@/components/CookieConsent", () => ({ CookieConsent: () => null }));
vi.mock("@/components/NotificationStream", () => ({ NotificationStream: () => <i data-testid="stream" /> }));

describe("RootLayout", () => {
  it("mounts the notification stream once, outside any route", () => {
    const html = renderToStaticMarkup(RootLayout({ children: <main /> }));
    expect(html.match(/data-testid="stream"/g)).toHaveLength(1);
  });
});
