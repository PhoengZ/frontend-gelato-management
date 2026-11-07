import { afterEach, describe, expect, it, vi } from "vitest";
import { dateInputValue, isSameBangkokDay, pickupSlots } from "@/lib/utils";

describe("dateInputValue", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the local calendar day just after midnight in Bangkok", () => {
    vi.stubEnv("TZ", "Asia/Bangkok");
    expect(dateInputValue(new Date(2026, 10, 7, 0, 30))).toBe("2026-11-07");
    expect(dateInputValue(new Date(2026, 10, 7, 6, 59))).toBe("2026-11-07");
    expect(dateInputValue(new Date(2026, 10, 7, 7, 0))).toBe("2026-11-07");
  });

  it("uses the local calendar day late in the evening west of UTC", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(dateInputValue(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("pickupSlots in Asia/Bangkok", () => {
  it("stops at the end of the Bangkok day", () => {
    // 23:20 in Bangkok: only 23:45 remains today.
    expect(pickupSlots(new Date("2026-11-07T16:20:00.000Z"))).toEqual(["2026-11-07T16:45:00.000Z"]);
  });

  it("offers nothing when no slot remains today", () => {
    expect(pickupSlots(new Date("2026-11-07T16:44:59.000Z"))).toEqual([]);
  });

  it("offers a full day's slots right after Bangkok midnight, which is still yesterday in UTC", () => {
    const slots = pickupSlots(new Date("2026-11-07T17:05:00.000Z"));
    expect(slots).toHaveLength(8);
    expect(slots[0]).toBe("2026-11-07T17:30:00.000Z");
  });

  it("compares calendar days in Bangkok", () => {
    expect(isSameBangkokDay(new Date("2026-11-07T17:00:00.000Z"), new Date("2026-11-08T16:59:59.000Z"))).toBe(true);
    expect(isSameBangkokDay(new Date("2026-11-07T16:59:59.000Z"), new Date("2026-11-07T17:00:00.000Z"))).toBe(false);
  });
});
