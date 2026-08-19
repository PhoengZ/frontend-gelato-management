import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartPage from "@/app/cart/page";
import { useCartStore } from "@/store/useCartStore";

const push = vi.fn();

vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  ApiClientError: class ApiClientError extends Error { status = 0; code = "TEST"; },
  useCatalog: () => ({ data: [{ id: "vanilla", availablePortions: 10 }], refetch: vi.fn() }),
  useCreateOrder: () => ({ isPending: false, mutate: vi.fn() }),
  useSession: () => ({ data: undefined, isLoading: false, isError: true })
}));

describe("Cart authentication gate", () => {
  beforeEach(() => {
    push.mockReset();
    useCartStore.setState({
      items: [{ flavorId: "vanilla", flavorName: "Vanilla", portions: 1, unitPrice: 85 }],
      idempotencyKey: null
    });
  });

  it("redirects an unauthenticated shopper before opening checkout", async () => {
    render(<CartPage />);
    await userEvent.click(screen.getByRole("button", { name: /proceed to checkout/i }));
    expect(push).toHaveBeenCalledWith("/login?next=/cart");
    expect(screen.queryByText("PROMPTPAY PAYMENT")).not.toBeInTheDocument();
  });
});
