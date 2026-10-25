import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, useCatalog, useCreateOrder, useFulfillments, useSignup, withAvailability } from "@/lib/api";
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

  it("unwraps the fulfillment list envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ items: [{ order_id: "o1" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useFulfillments(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/fulfillments?status=PREPARING,READY_FOR_PICKUP", expect.any(Object));
    expect(result.current.data).toEqual([{ order_id: "o1" }]);
  });
});
