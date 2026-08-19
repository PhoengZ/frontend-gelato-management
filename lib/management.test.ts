import { describe, expect, it } from "vitest";
import { analyticsSummary, createInventoryBatch, inventorySnapshot, recordWaste, updateFlavorInventory } from "@/lib/mock-db";

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
});
