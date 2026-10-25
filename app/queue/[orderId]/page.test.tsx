import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueueTracker } from "@/components/QueueTracker";
import { useCartStore } from "@/store/useCartStore";
import { useNotificationStore } from "@/store/useNotificationStore";

const useOrder = vi.fn();
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("@/lib/api", () => ({
  useOrder: (...args: unknown[]) => useOrder(...args),
  useCancelOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateOrder: () => ({ mutate: vi.fn(), isPending: false })
}));

const orderId = "8d29d6cf-bd4d-48ca-9e4f-dcd8ec54e594";
const order = {
  order_id: orderId,
  customer_id: "c1",
  pickup_at: "2026-10-25T10:00:00Z",
  reservation_expires_at: "2026-10-25T09:45:00Z",
  total_amount_minor: 17000,
  currency: "THB",
  items: [{ flavor_id: "v", flavor_name: "Vanilla", portions: 2, unit_price_minor: 8500, subtotal_minor: 17000 }],
  created_at: "2026-10-25T09:30:00Z",
  updated_at: "2026-10-25T09:30:00Z"
};

describe("QueueTracker", () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
    useCartStore.setState({ items: [], checkout: null });
  });

  it("offers to continue or cancel an unpaid order", () => {
    useOrder.mockReturnValue({ isLoading: false, isError: false, data: { ...order, status: "PENDING_PAYMENT" } });
    render(<QueueTracker orderId={orderId} />);
    expect(screen.getByText("AWAITING PAYMENT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel order/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /continue payment/i })).toBeDisabled();
  });

  it("clears the cart once its order is paid", () => {
    useCartStore.setState({
      items: [{ flavorId: "v", flavorName: "Vanilla", portions: 2, unitPriceMinor: 8500 }],
      checkout: { idempotencyKey: "k", order: { pickup_at: order.pickup_at, items: [] }, orderId }
    });
    useOrder.mockReturnValue({ isLoading: false, isError: false, data: { ...order, status: "PAID" } });
    render(<QueueTracker orderId={orderId} />);
    expect(screen.getByText("PAID — ORDER CONFIRMED")).toBeInTheDocument();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("shows the queue number from the order.ready notification", () => {
    useNotificationStore.getState().add({
      id: "e1",
      type: "order.ready",
      message: "Your gelato order is ready for pickup!",
      occurred_at: "2026-10-25T09:55:00Z",
      data: { order_id: orderId, queue_number: "07", pickup_slot_id: "s1" }
    });
    useOrder.mockReturnValue({ isLoading: false, isError: false, data: { ...order, status: "PAID" } });
    render(<QueueTracker orderId={orderId} />);
    expect(screen.getByLabelText("คิว 07")).toBeInTheDocument();
    expect(screen.getByText("READY NOW")).toBeInTheDocument();
  });
});
