import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartPage from "@/app/cart/page";
import { pickupSlots } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";

const push = vi.fn();
const mutate = vi.fn();
const session = vi.fn();

vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  ApiClientError: class ApiClientError extends Error { status = 0; code = "TEST"; },
  useCatalog: () => ({ data: [{ id: "vanilla-id", available_portions: 10 }], refetch: vi.fn() }),
  useCreateOrder: () => ({ isPending: false, mutate }),
  useSession: () => session()
}));

describe("CartPage", () => {
  beforeEach(() => {
    push.mockReset();
    mutate.mockReset();
    useCartStore.setState({
      items: [{ flavorId: "vanilla-id", flavorName: "Vanilla", portions: 2, unitPriceMinor: 8500 }],
      checkout: null
    });
  });

  it("redirects an unauthenticated shopper before opening checkout", async () => {
    session.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<CartPage />);
    await userEvent.click(screen.getByRole("button", { name: /proceed to checkout/i }));
    expect(push).toHaveBeenCalledWith("/login?next=/cart");
    expect(screen.queryByRole("button", { name: /pay with stripe/i })).not.toBeInTheDocument();
  });

  it("creates the order with a pickup time and its idempotency key", async () => {
    session.mockReturnValue({ data: { role: "CUSTOMER" }, isLoading: false, isError: false });
    render(<CartPage />);
    await userEvent.click(screen.getByRole("button", { name: /proceed to checkout/i }));
    await userEvent.click(await screen.findByRole("button", { name: /pay with stripe/i }));

    const checkout = useCartStore.getState().checkout!;
    expect(checkout.order.items).toEqual([{ flavor_id: "vanilla-id", portions: 2 }]);
    expect(new Date(checkout.order.pickup_at).getTime()).toBeGreaterThan(Date.now());
    expect(mutate).toHaveBeenCalledWith(
      { order: checkout.order, idempotencyKey: checkout.idempotencyKey },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
  });
});

describe("pickupSlots", () => {
  it("offers future 15-minute slots", () => {
    const slots = pickupSlots(new Date("2026-10-25T09:07:30.000Z"));
    expect(slots[0]).toBe("2026-10-25T09:30:00.000Z");
    expect(slots[1]).toBe("2026-10-25T09:45:00.000Z");
  });
});
