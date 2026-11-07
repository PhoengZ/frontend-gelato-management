import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, requestJson, useCatalog, useCreateOrder, useFulfillmentLookup, useFulfillments, useFulfillmentTicket, useOrder, useSignup, useStoreCancelOrder, withAvailability } from "@/lib/api";
import type { Flavor } from "@/types";

function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{children}</QueryClientProvider>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const vanilla: Flavor = {
  id: "6f1c7a2e-1111-4a1b-9c1d-000000000001",
  name: "Vanilla",
  description: "Madagascar vanilla",
  price: { amount_minor: 8500, currency: "THB" },
  allergens: ["MILK"],
  active: true,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z"
};

const order = {
  order_id: "8d29d6cf-bd4d-48ca-9e4f-dcd8ec54e594",
  customer_id: "c19b830e-a733-41de-bf26-aeb123926e36",
  pickup_at: "2026-10-25T10:00:00Z",
  status: "PENDING_PAYMENT",
  reservation_expires_at: "2026-10-25T09:45:00Z",
  total_amount_minor: 8500,
  currency: "THB",
  items: [{ flavor_id: vanilla.id, flavor_name: "Vanilla", portions: 1, unit_price_minor: 8500, subtotal_minor: 8500 }],
  created_at: "2026-10-25T09:30:00Z",
  updated_at: "2026-10-25T09:30:00Z",
  checkout_url: "https://checkout.stripe.com/c/pay/cs_test"
};

describe("API hooks", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("joins active catalog flavors with inventory availability", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(url.startsWith("/api/v1/flavors")
        ? json({ items: [vanilla] })
        : json({ items: [{ flavor_id: vanilla.id, available_portions: 12 }], as_of: "2026-10-25T09:00:00Z" }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCatalog(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/flavors?active=true", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/inventory/availability", expect.any(Object));
    expect(result.current.data).toEqual([{ ...vanilla, available_portions: 12 }]);
  });

  it("treats a flavor without availability as out of stock", () => {
    expect(withAvailability([vanilla], { items: [], as_of: "2026-10-25T09:00:00Z" })[0].available_portions).toBe(0);
  });

  it("creates an order with the Idempotency-Key header and snake_case body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(order, 201));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCreateOrder(), { wrapper });
    result.current.mutate({
      order: { pickup_at: order.pickup_at, items: [{ flavor_id: vanilla.id, portions: 1 }] },
      idempotencyKey: "00000000-0000-4000-8000-000000000001"
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/orders",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Idempotency-Key": "00000000-0000-4000-8000-000000000001" }),
        body: JSON.stringify({ pickup_at: order.pickup_at, items: [{ flavor_id: vanilla.id, portions: 1 }] })
      })
    );
    expect(result.current.data?.checkout_url).toBe(order.checkout_url);
  });

  it("normalizes backend errors and translates known codes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ code: "DEPENDENCY_CONFLICT", message: "insufficient stock", details: { order_id: "x" } }, 409)));
    const { result } = renderHook(() => useCreateOrder(), { wrapper });
    result.current.mutate({ order: { pickup_at: order.pickup_at, items: [{ flavor_id: vanilla.id, portions: 99 }] }, idempotencyKey: "k" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiClientError);
    expect(result.current.error).toMatchObject({ status: 409, code: "DEPENDENCY_CONFLICT", details: { order_id: "x" } });
    expect(result.current.error?.message).toContain("สต็อกไม่พอ");
  });

  it("signs up, then logs in because signup issues no token", async () => {
    const user = { id: "c1", email: "mint@example.com", display_name: "Mint", role: "CUSTOMER", status: "ACTIVE", created_at: "2026-10-25T00:00:00Z" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(user, 201))
      .mockResolvedValueOnce(json({ user, expires_in: 900 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSignup(), { wrapper });
    result.current.mutate({ display_name: "Mint", email: "mint@example.com", password: "secure123" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/auth/signup", expect.objectContaining({ method: "POST", body: expect.stringContaining("display_name") }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/auth/login", expect.objectContaining({ body: JSON.stringify({ email: "mint@example.com", password: "secure123" }) }));
  });

  it.each([
    "RESERVATION_EXPIRED",
    "SLOT_CAPACITY_EXCEEDED",
    "ORDER_STATE_CONFLICT",
    "INVALID_TRANSITION",
    "PORTIONS_LIMIT_EXCEEDED",
    "PICKUP_NOT_SAME_DAY",
    "ORDER_PREPARATION_STARTED"
  ])("translates %s to Thai", async (code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ code, message: "english from backend" }, 409)));
    const error = await requestJson("/api/v1/orders").catch((caught: ApiClientError) => caught);
    expect((error as ApiClientError).message).toMatch(/[\u0E00-\u0E7F]/);
    expect((error as ApiClientError).message).not.toContain("english");
  });

  describe("useFulfillmentTicket", () => {
    afterEach(() => vi.useRealTimers());

    const ticketUrl = `/api/v1/fulfillments/${order.order_id}`;

    it("does not fetch until the order is paid", () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      renderHook(() => useFulfillmentTicket(order.order_id, false), { wrapper });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("treats 404 as no ticket yet and keeps polling", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json({ code: "NOT_FOUND", message: "x" }, 404)));
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => useFulfillmentTicket(order.order_id, true), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
      expect(result.current.isError).toBe(false);
      expect(fetchMock).toHaveBeenCalledWith(ticketUrl, expect.any(Object));
      await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });

    it("stops polling once the ticket is picked up", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json({ order_id: order.order_id, status: "PICKED_UP", queue_number: "12" })));
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => useFulfillmentTicket(order.order_id, true), { wrapper });
      await waitFor(() => expect(result.current.data?.queue_number).toBe("12"));
      const calls = fetchMock.mock.calls.length;
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(fetchMock.mock.calls.length).toBe(calls);
    });
  });

  describe("useOrder polling", () => {
    afterEach(() => vi.useRealTimers());

    const orderCalls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter(([url]) => String(url).includes("/orders/")).length;

    it("stops once the ticket shows pickup, because Order stays at PAID", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fetchMock = vi.fn((url: string) =>
        Promise.resolve(url.includes("/fulfillments/") ? json({ status: "PICKED_UP", queue_number: "1" }) : json({ ...order, status: "PAID" }))
      );
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => ({ order: useOrder(order.order_id), ticket: useFulfillmentTicket(order.order_id, true) }), { wrapper });
      await waitFor(() => expect(result.current.ticket.data?.status).toBe("PICKED_UP"));
      await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
      const settled = orderCalls(fetchMock);
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(orderCalls(fetchMock)).toBe(settled);
    });

    it("stops after a 404 instead of hammering the backend", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fetchMock = vi.fn(() => Promise.resolve(json({ code: "NOT_FOUND", message: "x" }, 404)));
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => useOrder(order.order_id), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      const calls = fetchMock.mock.calls.length;
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(fetchMock.mock.calls.length).toBe(calls);
    });

    it("polls faster during the Stripe return window", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const fetchMock = vi.fn(() => Promise.resolve(json({ ...order, status: "PENDING_PAYMENT" })));
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => useOrder(order.order_id, { fastPoll: true }), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const calls = fetchMock.mock.calls.length;
      await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
      expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
    });
  });

  it("loads queued, preparing and ready tickets and unwraps the list envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ items: [{ order_id: "o1" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useFulfillments(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/fulfillments?status=QUEUED,PREPARING,READY_FOR_PICKUP", expect.any(Object));
    expect(result.current.data).toEqual([{ order_id: "o1" }]);
  });

  it("cancels a queued order for the store with an empty body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ...order, status: "CANCELLED" }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useStoreCancelOrder(), { wrapper });
    await act(async () => { await result.current.mutateAsync(order.order_id); });
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/orders/${order.order_id}/store-cancel`, expect.objectContaining({ method: "POST", body: "{}" }));
  });

  it("surfaces ORDER_PREPARATION_STARTED from a store cancel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ code: "ORDER_PREPARATION_STARTED", message: "x" }, 409)));
    const { result } = renderHook(() => useStoreCancelOrder(), { wrapper });
    const error = await result.current.mutateAsync(order.order_id).catch((caught: ApiClientError) => caught);
    expect(error).toMatchObject({ code: "ORDER_PREPARATION_STARTED", status: 409 });
  });

  describe("useFulfillmentLookup", () => {
    it("fetches nothing without an order id", () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      renderHook(() => useFulfillmentLookup(null), { wrapper });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fetches one ticket, including a picked-up one", async () => {
      const fetchMock = vi.fn().mockResolvedValue(json({ order_id: order.order_id, status: "PICKED_UP", queue_number: "04" }));
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => useFulfillmentLookup(order.order_id), { wrapper });
      await waitFor(() => expect(result.current.data?.status).toBe("PICKED_UP"));
      expect(fetchMock).toHaveBeenCalledWith(`/api/v1/fulfillments/${order.order_id}`, expect.any(Object));
    });

    it("treats 404 as no such ticket", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ code: "NOT_FOUND", message: "x" }, 404)));
      const { result } = renderHook(() => useFulfillmentLookup(order.order_id), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });
  });
});
