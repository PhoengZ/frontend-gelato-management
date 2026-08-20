import { describe, expect, it } from "vitest";
import { analyticsSummary, createFlavor, createInventoryBatch, deleteFlavor, inventorySnapshot, recordWaste, updateFlavor, updateFlavorInventory } from "@/lib/mock-db";

describe("batch inventory and waste", () => {
  it("adds a batch, updates catalog metadata, and records waste", () => {
    const before = inventorySnapshot().flavors.find((flavor) => flavor.id === "vanilla")!;
    const batch = createInventoryBatch({ flavorId: "vanilla", batchCode: "TEST-BATCH-01", portions: 5, producedAt: "2026-08-17", expiresAt: "2026-08-24" });
    expect(inventorySnapshot().flavors.find((flavor) => flavor.id === "vanilla")?.availablePortions).toBe(before.availablePortions + 5);

    const updated = updateFlavorInventory("vanilla", { allergens: ["Dairy", "Egg", "Dairy"] });
    expect(updated.allergens).toEqual(["Dairy", "Egg"]);

    recordWaste({ batchId: batch.id, portions: 2, reason: "Quality control" });
    expect(inventorySnapshot().batches.find((item) => item.id === batch.id)?.remainingPortions).toBe(3);
    expect(analyticsSummary().totalWaste).toBeGreaterThanOrEqual(2);
  });

  it("creates, edits, and deletes a menu item", () => {
    const created = createFlavor({
      name: `Dark Chocolate ${crypto.randomUUID().slice(0, 6)}`,
      description: "โกโก้เข้มข้น",
      pricePerPortion: 105,
      allergens: ["Dairy"],
      availablePortions: 4,
      imageUrl: "/hero/1.png",
      isAvailable: true
    });
    expect(inventorySnapshot().flavors).toContainEqual(created);
    expect(updateFlavor(created.id, { pricePerPortion: 110, name: "Dark Chocolate 70%" })).toMatchObject({ pricePerPortion: 110, name: "Dark Chocolate 70%" });
    expect(deleteFlavor(created.id).id).toBe(created.id);
    expect(inventorySnapshot().flavors.some((flavor) => flavor.id === created.id)).toBe(false);
  });

  it("returns a seven-day sales trend", () => {
    const summary = analyticsSummary();
    expect(summary.salesTrend).toHaveLength(7);
    expect(summary.salesTrend.at(-1)?.date).toBe(new Date().toISOString().slice(0, 10));
  });
});
