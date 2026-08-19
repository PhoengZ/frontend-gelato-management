import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlavorCard } from "@/components/FlavorCard";
import { useCartStore } from "@/store/useCartStore";
import type { Flavor } from "@/types";

const baseFlavor: Flavor = {
  id: "pistachio",
  name: "Pistachio Verde",
  description: "พิสตาชิโอคั่ว",
  pricePerPortion: 95,
  allergens: ["Nuts", "Dairy"],
  availablePortions: 2,
  imageUrl: "/flavors/pistachio.svg",
  isAvailable: true
};

describe("FlavorCard", () => {
  beforeEach(() => useCartStore.setState({ items: [], idempotencyKey: null }));

  it("shows compact availability metadata and adds an available flavor", async () => {
    render(<FlavorCard flavor={baseFlavor} />);
    expect(screen.getByText("Italy · Stock 2")).toBeInTheDocument();
    expect(screen.getByText("Contains · Nuts · Dairy")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ADD TO SELECTION" }));
    expect(useCartStore.getState().items[0]).toMatchObject({ flavorId: "pistachio", portions: 1 });
  });

  it("disables ordering when unavailable", () => {
    render(<FlavorCard flavor={{ ...baseFlavor, isAvailable: false, availablePortions: 0 }} />);
    expect(screen.getByRole("button", { name: "SOLD OUT" })).toBeDisabled();
  });
});
