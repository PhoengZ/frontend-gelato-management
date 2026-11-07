import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

const origin = "https://shop.example";

describe("safeNextPath", () => {
  it.each([
    ["backslash", "/\\example.invalid"],
    ["tab", "/\t/example.invalid"],
    ["line feed", "/\n/example.invalid"],
    ["protocol-relative", "//x"],
    ["absolute", "https://example.invalid/cart"],
    ["javascript scheme", "javascript:alert(1)"],
    ["dot-segment double slash", "/.//example.invalid"],
    ["same-origin double slash", "https://shop.example//example.invalid"]
  ])("falls back on %s", (_name, value) => {
    expect(safeNextPath(value, "/staff", origin)).toBe("/staff");
  });

  it("falls back when next is missing or empty", () => {
    expect(safeNextPath(null, "/", origin)).toBe("/");
    expect(safeNextPath("", "/manager", origin)).toBe("/manager");
  });

  it("keeps same-origin paths with their query and hash", () => {
    expect(safeNextPath("/cart", "/", origin)).toBe("/cart");
    expect(safeNextPath("/queue/1?returned_at=5#top", "/", origin)).toBe("/queue/1?returned_at=5#top");
    expect(safeNextPath("https://shop.example/cart", "/", origin)).toBe("/cart");
  });
});
