import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartPage from "@/app/cart/page";
import { ApiClientError } from "@/lib/api";
import { pickupSlots } from "@/lib/utils";
import { useCartStore } from "@/store/useCartStore";

const push = vi.fn();
const mutate = vi.fn();
const session = vi.fn();
const fetchOrder = vi.fn();
const cancelOrder = vi.fn();
const customer = { data: { role: "CUSTOMER" }, isLoading: false, isError: false };
const apiError = (code: string, status: number) => Object.assign(new ApiClientError("ข้อความ"), { code, status });

vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  ApiClientError: class ApiClientError extends Error { status = 0; code = "TEST"; },
  useCatalog: () => ({ data: [{ id: "vanilla-id", available_portions: 10 }], refetch: vi.fn() }),
  useCreateOrder: () => ({ isPending: false, mutate }),
  useSession: () => session(),
  fetchOrder: (...args: unknown[]) => fetchOrder(...args),
  cancelOrder: (...args: unknown[]) => cancelOrder(...args)
}));

describe("CartPage", () => {
  beforeEach(() => {
    // Mid-afternoon in Bangkok, so slots remain today whenever this suite runs.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-07T07:07:30.000Z"));
    push.mockReset();
    mutate.mockReset();
    fetchOrder.mockReset();
    cancelOrder.mockReset();
    useCartStore.setState({
      items: [{ flavorId: "vanilla-id", flavorName: "Vanilla", portions: 2, unitPriceMinor: 8500 }],
      checkout: null,
      ownerId: null,
      activeOrderId: null,
      unsettledOrderId: null
    });
  });

  afterEach(() => vi.useRealTimers());

  const openSheet = async () => {
    session.mockReturnValue(customer);
    render(<CartPage />);
    await userEvent.click(screen.getByRole("button", { name: "ไปชำระเงิน" }));
  };
  const payButton = () => screen.findByRole("button", { name: /^ชำระเงิน ฿/ });

  describe("same-day slots", () => {
    it("offers only today's slots in Asia/Bangkok", async () => {
      vi.setSystemTime(new Date("2026-11-07T16:20:00.000Z"));
      await openSheet();
      expect(await screen.findAllByRole("radio")).toHaveLength(1);
    });

    it("explains when no slot remains today and blocks payment", async () => {
      vi.setSystemTime(new Date("2026-11-07T16:50:00.000Z"));
      await openSheet();
      expect(await screen.findByText(/วันนี้ไม่มีรอบรับสินค้าเหลือแล้ว/)).toBeInTheDocument();
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
      expect(await payButton()).toBeDisabled();
    });

    it("does not keep an earlier pickup that falls on another Bangkok day", async () => {
      useCartStore.setState({ checkout: { idempotencyKey: "k", order: { pickup_at: "2026-11-08T03:00:00.000Z", items: [] } } });
      await openSheet();
      const radios = await screen.findAllByRole("radio");
      expect(radios).toHaveLength(8);
      await userEvent.click(await payButton());
      expect(useCartStore.getState().checkout?.order.pickup_at).toBe("2026-11-07T07:30:00.000Z");
    });
  });

  describe("U03 unsettled order after the cart was edited", () => {
    it("does not charge again when the edited-away order was paid, and keeps the edited cart", async () => {
      useCartStore.setState({ unsettledOrderId: "prior" });
      fetchOrder.mockResolvedValue({ order_id: "prior", status: "PAID" });
      await openSheet();
      await userEvent.click(await payButton());
      await waitFor(() => expect(push).toHaveBeenCalledWith("/queue/prior"));
      expect(mutate).not.toHaveBeenCalled();
      expect(useCartStore.getState()).toMatchObject({ activeOrderId: "prior", unsettledOrderId: null });
      expect(useCartStore.getState().items).toHaveLength(1);
    });

    it("cancels a superseded unpaid order before creating the new one", async () => {
      useCartStore.setState({ unsettledOrderId: "prior" });
      fetchOrder.mockResolvedValue({ order_id: "prior", status: "PENDING_PAYMENT" });
      cancelOrder.mockResolvedValue(undefined);
      await openSheet();
      await userEvent.click(await payButton());
      await waitFor(() => expect(mutate).toHaveBeenCalled());
      expect(cancelOrder).toHaveBeenCalledWith("prior");
      expect(useCartStore.getState().unsettledOrderId).toBeNull();
    });

    it("blocks the new charge when the superseded order cannot be cancelled", async () => {
      useCartStore.setState({ unsettledOrderId: "prior" });
      fetchOrder.mockResolvedValue({ order_id: "prior", status: "PENDING_PAYMENT" });
      cancelOrder.mockRejectedValue(apiError("ORDER_STATE_CONFLICT", 409));
      await openSheet();
      await userEvent.click(await payButton());
      await waitFor(() => expect(cancelOrder).toHaveBeenCalled());
      expect(mutate).not.toHaveBeenCalled();
      expect(useCartStore.getState().unsettledOrderId).toBe("prior");
    });

    it("blocks the new charge when the order cannot be checked", async () => {
      useCartStore.setState({ unsettledOrderId: "prior" });
      fetchOrder.mockRejectedValue(apiError("SERVICE_UNAVAILABLE", 503));
      await openSheet();
      await userEvent.click(await payButton());
      await waitFor(() => expect(fetchOrder).toHaveBeenCalled());
      expect(mutate).not.toHaveBeenCalled();
    });

    it("lets a customer who already saw a paid order place another", async () => {
      useCartStore.setState({ activeOrderId: "seen", unsettledOrderId: null });
      await openSheet();
      await userEvent.click(await payButton());
      await waitFor(() => expect(mutate).toHaveBeenCalled());
      expect(fetchOrder).not.toHaveBeenCalled();
    });

    it("cancels the unpaid order when only the pickup time changed", async () => {
      const stale = { idempotencyKey: "old-key", order: { pickup_at: "2026-11-07T08:00:00.000Z", items: [] }, orderId: "prior" };
      useCartStore.setState({ checkout: stale, unsettledOrderId: "prior" });
      fetchOrder.mockResolvedValue({ order_id: "prior", status: "PENDING_PAYMENT" });
      cancelOrder.mockResolvedValue(undefined);
      session.mockReturnValue(customer);
      render(<CartPage />);
      await userEvent.click(screen.getByRole("button", { name: "ไปชำระเงิน" }));
      const other = screen.getAllByRole("radio").find((slot) => !(slot as HTMLInputElement).checked && slot.getAttribute("aria-checked") !== "true");
      await userEvent.click(other!);
      await userEvent.click(await payButton());
      await waitFor(() => expect(cancelOrder).toHaveBeenCalledWith("prior"));
    });
  });

  describe("U03 prior order", () => {
    const prior = { idempotencyKey: "old-key", order: { pickup_at: "2026-11-07T05:00:00.000Z", items: [] }, orderId: "prior" };

    it.each(["PAID", "PREPARING", "READY_FOR_PICKUP"])("goes to the %s order instead of charging again", async (status) => {
      useCartStore.setState({ checkout: prior });
      fetchOrder.mockResolvedValue({ order_id: "prior", status });
      await openSheet();
      await userEvent.click(await payButton());
      expect(fetchOrder).toHaveBeenCalledWith("prior");
      expect(mutate).not.toHaveBeenCalled();
      expect(useCartStore.getState()).toMatchObject({ items: [], checkout: null, activeOrderId: "prior" });
      expect(push).toHaveBeenCalledWith("/queue/prior");
    });

    it("does not mark a completed prior order as active", async () => {
      useCartStore.setState({ checkout: prior });
      fetchOrder.mockResolvedValue({ order_id: "prior", status: "COMPLETED" });
      await openSheet();
      await userEvent.click(await payButton());
      expect(mutate).not.toHaveBeenCalled();
      expect(useCartStore.getState()).toMatchObject({ items: [], activeOrderId: null });
    });

    it("does not start a new charge while payment is confirming", async () => {
      useCartStore.setState({ checkout: prior });
      fetchOrder.mockResolvedValue({ order_id: "prior", status: "PAYMENT_CONFIRMING" });
      await openSheet();
      await userEvent.click(await payButton());
      expect(mutate).not.toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/queue/prior");
    });

    it.each([
      ["cancelled", () => fetchOrder.mockResolvedValue({ order_id: "prior", status: "CANCELLED" })],
      ["missing", () => fetchOrder.mockRejectedValue(apiError("NOT_FOUND", 404))]
    ])("starts a fresh checkout when the prior order is %s", async (_name, arrange) => {
      useCartStore.setState({ checkout: prior });
      arrange();
      await openSheet();
      await userEvent.click(await payButton());
      await waitFor(() => expect(mutate).toHaveBeenCalled());
      expect(useCartStore.getState().checkout?.idempotencyKey).not.toBe("old-key");
    });

    it("continues with the same checkout while the prior order is unpaid", async () => {
      const same = { ...prior, order: { pickup_at: "2026-11-07T07:30:00.000Z", items: [] } };
      useCartStore.setState({ checkout: same });
      fetchOrder.mockResolvedValue({ order_id: "prior", status: "PENDING_PAYMENT" });
      await openSheet();
      await userEvent.click(await payButton());
      await waitFor(() => expect(mutate).toHaveBeenCalled());
      expect(useCartStore.getState().checkout?.idempotencyKey).toBe("old-key");
    });

    it("refuses to charge when the prior order cannot be checked", async () => {
      useCartStore.setState({ checkout: prior });
      fetchOrder.mockRejectedValue(apiError("DEPENDENCY_UNAVAILABLE", 503));
      await openSheet();
      await userEvent.click(await payButton());
      await waitFor(() => expect(fetchOrder).toHaveBeenCalled());
      expect(mutate).not.toHaveBeenCalled();
      expect(useCartStore.getState().checkout?.idempotencyKey).toBe("old-key");
    });

    it("sends an expired session to login while checking", async () => {
      useCartStore.setState({ checkout: prior });
      fetchOrder.mockRejectedValue(apiError("UNAUTHORIZED", 401));
      await openSheet();
      await userEvent.click(await payButton());
      await waitFor(() => expect(push).toHaveBeenCalledWith("/login?next=/cart"));
      expect(mutate).not.toHaveBeenCalled();
    });
  });

  describe("U14 expired reservation", () => {
    it("discards the checkout on RESERVATION_EXPIRED so the next attempt uses a new key", async () => {
      await openSheet();
      mutate.mockImplementationOnce((_input, { onError }) => onError(apiError("RESERVATION_EXPIRED", 409)));
      await userEvent.click(await payButton());
      const firstKey = mutate.mock.calls[0][0].idempotencyKey;
      expect(useCartStore.getState().checkout).toBeNull();

      await userEvent.click(await payButton());
      expect(mutate.mock.calls[1][0].idempotencyKey).not.toBe(firstKey);
    });
  });

  it("redirects an unauthenticated shopper before opening checkout", async () => {
    session.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<CartPage />);
    await userEvent.click(screen.getByRole("button", { name: "ไปชำระเงิน" }));
    expect(push).toHaveBeenCalledWith("/login?next=/cart");
    expect(screen.queryByRole("button", { name: /^ชำระเงิน ฿/ })).not.toBeInTheDocument();
  });

  it("creates the order with a pickup time and its idempotency key", async () => {
    session.mockReturnValue({ data: { role: "CUSTOMER" }, isLoading: false, isError: false });
    render(<CartPage />);
    await userEvent.click(screen.getByRole("button", { name: "ไปชำระเงิน" }));
    await userEvent.click(await screen.findByRole("button", { name: /^ชำระเงิน ฿/ }));

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
