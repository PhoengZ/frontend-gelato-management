import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlavorCard } from "@/components/FlavorCard";
import { useCartStore } from "@/store/useCartStore";
import type { MenuFlavor } from "@/types";

const baseFlavor: MenuFlavor = {
  id: "6f1c7a2e-1111-4a1b-9c1d-000000000002",
  name: "Pistachio Verde",
  description: "พิสตาชิโอคั่ว",
  price: { amount_minor: 9500, currency: "THB" },
  allergens: ["TREE_NUT", "MILK"],
  image_url: "https://cdn.example.com/pistachio.png",
  active: true,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  available_portions: 2
};

describe("FlavorCard", () => {
  beforeEach(() => useCartStore.setState({ items: [], checkout: null }));

  it("shows price, stock and allergens, and adds an available flavor", async () => {
    render(<FlavorCard flavor={baseFlavor} />);
    expect(screen.getByText("Italy · Stock 2")).toBeInTheDocument();
    expect(screen.getByText("Contains · Tree nut · Milk")).toBeInTheDocument();
    expect(screen.getByText(/95/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "ADD TO SELECTION" }));
    expect(useCartStore.getState().items[0]).toMatchObject({ flavorId: baseFlavor.id, portions: 1, unitPriceMinor: 9500 });
  });

  it("disables ordering when out of stock", () => {
    render(<FlavorCard flavor={{ ...baseFlavor, available_portions: 0 }} />);
    expect(screen.getByRole("button", { name: "SOLD OUT" })).toBeDisabled();
  });
});
