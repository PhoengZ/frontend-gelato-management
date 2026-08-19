import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, useCatalog, useCreateOrder } from "@/lib/api";

function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe("API hooks", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches the catalog", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCatalog(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/catalog/flavors", expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("sends the idempotency key in the request body and header", async () => {
    const response = { orderId: "o1", queueNumber: "A-001", status: "PREPARING", createdAt: new Date().toISOString() };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCreateOrder(), { wrapper });
    result.current.mutate({ items: [{ flavorId: "p", portions: 1 }], paymentMethod: "PROMPTPAY_MOCK", idempotencyKey: "key-1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/orders",
      expect.objectContaining({ headers: expect.objectContaining({ "X-Idempotency-Key": "key-1" }), body: expect.stringContaining("key-1") })
    );
  });

  it("normalizes API failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "OUT_OF_STOCK", message: "หมดแล้ว" }), { status: 400 })));
    const { result } = renderHook(() => useCreateOrder(), { wrapper });
    result.current.mutate({ items: [{ flavorId: "p", portions: 2 }], paymentMethod: "PROMPTPAY_MOCK", idempotencyKey: "key-2" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiClientError);
    expect(result.current.error).toMatchObject({ status: 400, code: "OUT_OF_STOCK", message: "หมดแล้ว" });
  });
});
