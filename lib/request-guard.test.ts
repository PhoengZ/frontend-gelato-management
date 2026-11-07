// @vitest-environment node
import { describe, expect, it } from "vitest";
import { crossSiteRejection } from "@/lib/request-guard";

function post(headers: Record<string, string>, url = "http://frontend:3000/api/v1/orders") {
  return new Request(url, { method: "POST", headers });
}

describe("crossSiteRejection", () => {
  it("allows same-origin requests and requests without browser fetch metadata", () => {
    expect(crossSiteRejection(post({}))).toBeNull();
    expect(crossSiteRejection(post({ "sec-fetch-site": "same-origin", origin: "http://frontend:3000" }))).toBeNull();
    expect(crossSiteRejection(post({ "sec-fetch-site": "none" }))).toBeNull();
  });

  it.each(["cross-site", "same-site"])("rejects Sec-Fetch-Site %s", async (site) => {
    const response = crossSiteRejection(post({ "sec-fetch-site": site }));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ code: "CROSS_SITE_REQUEST_REJECTED", message: expect.any(String) });
  });

  it("compares Origin with the request host", () => {
    expect(crossSiteRejection(post({ origin: "https://attacker.invalid", host: "shop.example" }))?.status).toBe(403);
    expect(crossSiteRejection(post({ origin: "null", host: "shop.example" }))?.status).toBe(403);
    expect(crossSiteRejection(post({ origin: "https://shop.example", host: "shop.example" }))).toBeNull();
  });

  it("respects x-forwarded-host because Caddy proxies to Next", () => {
    const proxied = { host: "frontend:3000", "x-forwarded-host": "shop.example" };
    expect(crossSiteRejection(post({ ...proxied, origin: "https://shop.example" }))).toBeNull();
    expect(crossSiteRejection(post({ ...proxied, origin: "https://frontend:3000" }))?.status).toBe(403);
    expect(crossSiteRejection(post({ host: "frontend:3000", "x-forwarded-host": "shop.example, internal", origin: "https://shop.example" }))).toBeNull();
    expect(crossSiteRejection(post({ host: "shop.example:443", origin: "https://shop.example" }))).toBeNull();
  });

  it("requires a JSON body only when asked", () => {
    expect(crossSiteRejection(post({ "content-type": "text/plain" }))).toBeNull();
    expect(crossSiteRejection(post({ "content-type": "text/plain" }), { requireJson: true })?.status).toBe(403);
    expect(crossSiteRejection(post({}), { requireJson: true })?.status).toBe(403);
    expect(crossSiteRejection(post({ "content-type": "application/json; charset=utf-8" }), { requireJson: true })).toBeNull();
  });
});
