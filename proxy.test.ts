// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

describe("proxy", () => {
  it("keeps the query string in next so the checkout marker survives a login", () => {
    const response = proxy(new NextRequest("https://shop.example/queue/o1?returned_at=5"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/queue/o1?returned_at=5");
  });
});
