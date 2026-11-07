import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QueuePage from "@/app/queue/[orderId]/page";
import { QueueTracker } from "@/components/QueueTracker";
import { useCartStore } from "@/store/useCartStore";
import { useNotificationStore } from "@/store/useNotificationStore";

const useOrder = vi.fn();
const useFulfillmentTicket = vi.fn();
const cancelMutate = vi.fn();
const createMutate = vi.fn();
const replace = vi.fn();
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  useOrder: (...args: unknown[]) => useOrder(...args),
  useFulfillmentTicket: (...args: unknown[]) => useFulfillmentTicket(...args),
  useCancelOrder: () => ({ mutate: cancelMutate, isPending: false }),
  useCreateOrder: () => ({ mutate: createMutate, isPending: false })
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
const inTenMinutes = () => new Date(Date.now() + 600_000).toISOString();
const checkoutFor = (id: string) => ({ idempotencyKey: "k", order: { pickup_at: order.pickup_at, items: [] }, orderId: id });
const loaded = (status: string, extra: object = {}) => ({ isLoading: false, isError: false, data: { ...order, status, ...extra } });

describe("QueueTracker", () => {
  beforeEach(() => {
    replace.mockReset();
    cancelMutate.mockReset();
    createMutate.mockReset();
    useOrder.mockReset();
    useFulfillmentTicket.mockReset();
    useFulfillmentTicket.mockReturnValue({ data: undefined });
    useNotificationStore.setState({ notifications: [], ownerId: "c1" });
    useCartStore.setState({ items: [], checkout: null, ownerId: "c1", activeOrderId: null, unsettledOrderId: null });
  });

  afterEach(() => vi.useRealTimers());

  it.each(["PAID", "CANCELLED"])("settles the order once the customer sees it is %s", (status) => {
    useCartStore.setState({ unsettledOrderId: orderId });
    useOrder.mockReturnValue(loaded(status));
    render(<QueueTracker orderId={orderId} />);
    expect(useCartStore.getState().unsettledOrderId).toBeNull();
  });

  it("keeps an unpaid order unsettled", () => {
    useCartStore.setState({ unsettledOrderId: orderId });
    useOrder.mockReturnValue(loaded("PENDING_PAYMENT"));
    render(<QueueTracker orderId={orderId} />);
    expect(useCartStore.getState().unsettledOrderId).toBe(orderId);
  });

  it("offers to continue or cancel an unpaid order", () => {
    useOrder.mockReturnValue(loaded("PENDING_PAYMENT"));
    render(<QueueTracker orderId={orderId} />);
    expect(screen.getByText("รอชำระเงิน")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ยกเลิกคำสั่งซื้อ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "ชำระเงินต่อ" })).toBeDisabled();
  });

  it("clears the cart once its order is paid", () => {
    useCartStore.setState({
      items: [{ flavorId: "v", flavorName: "Vanilla", portions: 2, unitPriceMinor: 8500 }],
      checkout: checkoutFor(orderId)
    });
    useOrder.mockReturnValue(loaded("PAID"));
    render(<QueueTracker orderId={orderId} />);
    expect(screen.getByText("ชำระเงินแล้ว")).toBeInTheDocument();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("shows the queue number from the order.ready notification", () => {
    useNotificationStore.getState().add({
      id: "e1",
      type: "order.ready",
      message: "Your gelato order is ready for pickup!",
      occurred_at: "2026-10-25T09:55:00Z",
      data: { order_id: orderId, queue_number: "07", pickup_slot_id: "s1" }
    }, "c1");
    useOrder.mockReturnValue(loaded("PAID"));
    render(<QueueTracker orderId={orderId} />);
    expect(screen.getByLabelText("คิว 07")).toBeInTheDocument();
    expect(screen.getByText("พร้อมรับเลย")).toBeInTheDocument();
  });

  describe("F01 ticket as the source of truth", () => {
    it("polls the ticket only for a paid-or-later order", () => {
      useOrder.mockReturnValue(loaded("PENDING_PAYMENT"));
      render(<QueueTracker orderId={orderId} />);
      expect(useFulfillmentTicket).toHaveBeenLastCalledWith(orderId, false);
      useOrder.mockReturnValue(loaded("PAID"));
      render(<QueueTracker orderId={orderId} />);
      expect(useFulfillmentTicket).toHaveBeenLastCalledWith(orderId, true);
    });

    it("stops polling the ticket for a cancelled order", () => {
      useOrder.mockReturnValue(loaded("CANCELLED"));
      render(<QueueTracker orderId={orderId} />);
      expect(useFulfillmentTicket).toHaveBeenLastCalledWith(orderId, false);
    });

    it("shows ready and the queue number from the ticket with no notification", () => {
      useOrder.mockReturnValue(loaded("PAID"));
      useFulfillmentTicket.mockReturnValue({ data: { status: "READY_FOR_PICKUP", queue_number: "12" } });
      render(<QueueTracker orderId={orderId} />);
      expect(screen.getByLabelText("คิว 12")).toBeInTheDocument();
      expect(screen.getByText("พร้อมรับเลย")).toBeInTheDocument();
    });

    it("shows completed when the ticket is picked up", () => {
      useOrder.mockReturnValue(loaded("PAID"));
      useFulfillmentTicket.mockReturnValue({ data: { status: "PICKED_UP", queue_number: "12" } });
      render(<QueueTracker orderId={orderId} />);
      expect(screen.getByText("รับสินค้าแล้ว")).toBeInTheDocument();
    });

    it("shows a queued ticket as paid and waiting in the kitchen queue, with its number", () => {
      useOrder.mockReturnValue(loaded("PAID"));
      useFulfillmentTicket.mockReturnValue({ data: { status: "QUEUED", queue_number: "05" } });
      render(<QueueTracker orderId={orderId} />);
      expect(screen.getByLabelText("คิว 05")).toBeInTheDocument();
      expect(screen.getByText("รอคิวในครัว")).toBeInTheDocument();
      expect(screen.getByText(/ชำระเงินเรียบร้อยแล้ว/)).toBeInTheDocument();
    });

    it("keeps PAID while the ticket does not exist yet", () => {
      useOrder.mockReturnValue(loaded("PAID"));
      useFulfillmentTicket.mockReturnValue({ data: null });
      render(<QueueTracker orderId={orderId} />);
      expect(screen.getByText("ชำระเงินแล้ว")).toBeInTheDocument();
    });
  });

  describe("F05 active order", () => {
    it("records the paid order as active while clearing the cart", () => {
      useCartStore.setState({ items: [{ flavorId: "v", flavorName: "Vanilla", portions: 2, unitPriceMinor: 8500 }], checkout: checkoutFor(orderId) });
      useOrder.mockReturnValue(loaded("PAID"));
      render(<QueueTracker orderId={orderId} />);
      expect(useCartStore.getState()).toMatchObject({ checkout: null, activeOrderId: orderId });
    });

    it.each([
      ["a picked-up ticket", "PAID", { status: "PICKED_UP", queue_number: "1" }],
      ["a cancelled order", "CANCELLED", undefined]
    ])("clears the active order at %s", (_name, status, ticket) => {
      useCartStore.setState({ activeOrderId: orderId });
      useOrder.mockReturnValue(loaded(status));
      useFulfillmentTicket.mockReturnValue({ data: ticket });
      render(<QueueTracker orderId={orderId} />);
      expect(useCartStore.getState().activeOrderId).toBeNull();
    });

    it("keeps the active order while it is being prepared", () => {
      useCartStore.setState({ activeOrderId: orderId });
      useOrder.mockReturnValue(loaded("PAID"));
      useFulfillmentTicket.mockReturnValue({ data: { status: "PREPARING", queue_number: "1" } });
      render(<QueueTracker orderId={orderId} />);
      expect(useCartStore.getState().activeOrderId).toBe(orderId);
    });
  });

  describe("F10 error states", () => {
    const failed = (status: number) => ({ isLoading: false, isError: true, data: undefined, error: Object.assign(new Error("x"), { status }), refetch: vi.fn() });

    it("keeps a loaded order on screen with a stale notice when a refetch fails", () => {
      useOrder.mockReturnValue({ ...loaded("PAID"), isError: true, error: Object.assign(new Error("x"), { status: 503 }), refetch: vi.fn() });
      render(<QueueTracker orderId={orderId} />);
      expect(screen.getByText("ชำระเงินแล้ว")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("ข้อมูลอาจไม่เป็นปัจจุบัน");
      expect(screen.queryByText("ไม่พบคำสั่งซื้อนี้")).not.toBeInTheDocument();
    });

    it("shows not found only for 404", () => {
      useOrder.mockReturnValue(failed(404));
      render(<QueueTracker orderId={orderId} />);
      expect(screen.getByText("ไม่พบคำสั่งซื้อนี้")).toBeInTheDocument();
    });

    it("clears a dead active-order link on 404", () => {
      useCartStore.setState({ activeOrderId: orderId });
      useOrder.mockReturnValue(failed(404));
      render(<QueueTracker orderId={orderId} />);
      expect(useCartStore.getState().activeOrderId).toBeNull();
    });

    it.each([503, 500, 0])("shows a temporary problem with retry for status %i", async (status) => {
      const query = failed(status);
      useOrder.mockReturnValue(query);
      render(<QueueTracker orderId={orderId} />);
      expect(screen.queryByText("ไม่พบคำสั่งซื้อนี้")).not.toBeInTheDocument();
      expect(screen.getByText("ระบบขัดข้องชั่วคราว")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
      expect(query.refetch).toHaveBeenCalled();
    });

    it("sends a 401 to login with next", () => {
      window.history.replaceState(null, "", `/queue/${orderId}`);
      useOrder.mockReturnValue(failed(401));
      render(<QueueTracker orderId={orderId} />);
      expect(replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent(`/queue/${orderId}`)}`);
      expect(screen.queryByText("ไม่พบคำสั่งซื้อนี้")).not.toBeInTheDocument();
    });

    it("sends a 401 to login even when an order is already loaded", () => {
      useOrder.mockReturnValue({ ...loaded("PAID"), isError: true, error: Object.assign(new Error("x"), { status: 401 }) });
      render(<QueueTracker orderId={orderId} />);
      expect(replace).toHaveBeenCalled();
    });
  });

  describe("U04 cancel confirmation and Stripe return", () => {
    it("asks for confirmation before cancelling", async () => {
      useOrder.mockReturnValue(loaded("PENDING_PAYMENT"));
      render(<QueueTracker orderId={orderId} />);
      await userEvent.click(screen.getByRole("button", { name: "ยกเลิกคำสั่งซื้อ" }));
      expect(cancelMutate).not.toHaveBeenCalled();
      await userEvent.click(await screen.findByRole("button", { name: "ยืนยันการยกเลิก" }));
      expect(cancelMutate).toHaveBeenCalledWith(orderId, expect.any(Object));
    });

    it("does not cancel when the confirmation is dismissed", async () => {
      useOrder.mockReturnValue(loaded("PENDING_PAYMENT"));
      render(<QueueTracker orderId={orderId} />);
      await userEvent.click(screen.getByRole("button", { name: "ยกเลิกคำสั่งซื้อ" }));
      await userEvent.click(await screen.findByRole("button", { name: "ไม่ยกเลิก" }));
      expect(cancelMutate).not.toHaveBeenCalled();
    });

    it("hides Pay and Cancel and polls fast right after the Stripe return, then falls back", () => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      useOrder.mockReturnValue(loaded("PENDING_PAYMENT", { reservation_expires_at: inTenMinutes() }));
      render(<QueueTracker orderId={orderId} returnedAt={Date.now()} />);

      expect(screen.getByText("กำลังยืนยันการชำระเงิน")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "ชำระเงินต่อ" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "ยกเลิกคำสั่งซื้อ" })).not.toBeInTheDocument();
      expect(useOrder).toHaveBeenLastCalledWith(orderId, { fastPoll: true });

      act(() => { vi.advanceTimersByTime(60_001); });

      expect(screen.queryByText("กำลังยืนยันการชำระเงิน")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "ยกเลิกคำสั่งซื้อ" })).toBeInTheDocument();
      expect(useOrder).toHaveBeenLastCalledWith(orderId, { fastPoll: false });
    });

    it("ignores a marker older than the window", () => {
      useOrder.mockReturnValue(loaded("PENDING_PAYMENT"));
      render(<QueueTracker orderId={orderId} returnedAt={Date.now() - 61_000} />);
      expect(screen.queryByText("กำลังยืนยันการชำระเงิน")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "ยกเลิกคำสั่งซื้อ" })).toBeInTheDocument();
    });

    it("passes the return marker from the URL to the tracker", async () => {
      const page = await QueuePage({ params: Promise.resolve({ orderId }), searchParams: Promise.resolve({ returned_at: "1234" }) });
      expect(page.props).toMatchObject({ orderId, returnedAt: 1234 });
      const plain = await QueuePage({ params: Promise.resolve({ orderId }), searchParams: Promise.resolve({ returned_at: "junk" }) });
      expect(plain.props.returnedAt).toBeUndefined();
    });
  });

  describe("U14 expired hold", () => {
    it("disables Pay once the hold time has passed", () => {
      useCartStore.setState({ checkout: checkoutFor(orderId) });
      useOrder.mockReturnValue(loaded("PENDING_PAYMENT", { reservation_expires_at: new Date(Date.now() - 1_000).toISOString() }));
      render(<QueueTracker orderId={orderId} />);
      expect(screen.getByRole("button", { name: "ชำระเงินต่อ" })).toBeDisabled();
      expect(screen.getByText(/หมดเวลาจองสต็อกแล้ว/)).toBeInTheDocument();
    });

    it("disables Pay when the hold expires while the page is open", () => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      useCartStore.setState({ checkout: checkoutFor(orderId) });
      useOrder.mockReturnValue(loaded("PENDING_PAYMENT", { reservation_expires_at: new Date(Date.now() + 5_000).toISOString() }));
      render(<QueueTracker orderId={orderId} />);
      expect(screen.getByRole("button", { name: "ชำระเงินต่อ" })).toBeEnabled();
      act(() => { vi.advanceTimersByTime(5_001); });
      expect(screen.getByRole("button", { name: "ชำระเงินต่อ" })).toBeDisabled();
    });

    it("discards the checkout when the backend reports an expired hold", async () => {
      useCartStore.setState({ checkout: checkoutFor(orderId) });
      useOrder.mockReturnValue(loaded("PENDING_PAYMENT", { reservation_expires_at: inTenMinutes() }));
      createMutate.mockImplementation((_input, { onError }) => onError(Object.assign(new Error("หมดเวลา"), { code: "RESERVATION_EXPIRED", status: 409 })));
      render(<QueueTracker orderId={orderId} />);
      await userEvent.click(screen.getByRole("button", { name: "ชำระเงินต่อ" }));
      expect(useCartStore.getState().checkout).toBeNull();
    });
  });
});
