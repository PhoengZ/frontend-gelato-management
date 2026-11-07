import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MenuPage from "@/app/page";
import { useCartStore } from "@/store/useCartStore";

const useOrder = vi.fn();
const useFulfillmentTicket = vi.fn();
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("@/lib/api", () => ({
  useCatalog: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useOrder: (...args: unknown[]) => useOrder(...args),
  useFulfillmentTicket: (...args: unknown[]) => useFulfillmentTicket(...args)
}));

const label = "ติดตามคำสั่งซื้อล่าสุดของคุณ";

describe("StoreStatus tracking link", () => {
  beforeEach(() => {
    useOrder.mockReset();
    useFulfillmentTicket.mockReset();
    useOrder.mockReturnValue({ data: { status: "PAID" } });
    useFulfillmentTicket.mockReturnValue({ data: null });
    useCartStore.setState({ items: [], checkout: null, ownerId: "u", activeOrderId: "o1" });
  });

  it("links to the active order after the cart and checkout are gone", () => {
    render(<MenuPage />);
    expect(screen.getByRole("link", { name: new RegExp(label) })).toHaveAttribute("href", "/queue/o1");
  });

  it("does not take the link from a checkout", () => {
    useCartStore.setState({ activeOrderId: null, checkout: { idempotencyKey: "k", order: { pickup_at: "x", items: [] }, orderId: "o2" } });
    render(<MenuPage />);
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it("removes the link once the order is picked up, without visiting the queue page", () => {
    useFulfillmentTicket.mockReturnValue({ data: { status: "PICKED_UP" } });
    render(<MenuPage />);
    expect(useCartStore.getState().activeOrderId).toBeNull();
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it("removes the link once the order is cancelled or gone", () => {
    useOrder.mockReturnValue({ data: { status: "CANCELLED" } });
    render(<MenuPage />);
    expect(useCartStore.getState().activeOrderId).toBeNull();

    useCartStore.setState({ activeOrderId: "o1" });
    useOrder.mockReturnValue({ data: undefined, error: { status: 404 } });
    render(<MenuPage />);
    expect(useCartStore.getState().activeOrderId).toBeNull();
  });

  it("keeps the link through a transient failure", () => {
    useOrder.mockReturnValue({ data: undefined, error: { status: 503 } });
    render(<MenuPage />);
    expect(useCartStore.getState().activeOrderId).toBe("o1");
  });
});
