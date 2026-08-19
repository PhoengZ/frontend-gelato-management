"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ApiError,
  AnalyticsSummary,
  AuthSession,
  Flavor,
  InventoryBatch,
  InventorySnapshot,
  OrderRequest,
  OrderResponse,
  OrderStatus,
  QueueStatusResponse,
  StaffOrder,
  UpdateOrderStatusRequest,
  WasteRecord
} from "@/types";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiClientError extends Error implements ApiError {
  code: string;
  status: number;

  constructor(message: string, code = "UNKNOWN_ERROR", status = 0) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers }
    });
  } catch {
    throw new ApiClientError("เชื่อมต่อบริการไม่สำเร็จ กรุณาลองอีกครั้ง", "NETWORK_ERROR");
  }

  if (!response.ok) {
    let error: Partial<ApiError> = {};
    try {
      error = (await response.json()) as Partial<ApiError>;
    } catch {
      // The gateway may return an empty or non-JSON response.
    }
    throw new ApiClientError(
      error.message ?? "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง",
      error.code ?? `HTTP_${response.status}`,
      response.status
    );
  }

  return (await response.json()) as T;
}

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: () => requestJson<Flavor[]>("/api/v1/catalog/flavors")
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (order: OrderRequest) =>
      requestJson<OrderResponse>("/api/v1/orders", {
        method: "POST",
        headers: { "X-Idempotency-Key": order.idempotencyKey },
        body: JSON.stringify(order)
      })
  });
}

export function useQueueStatus(orderId: string) {
  return useQuery({
    queryKey: ["queue-status", orderId],
    queryFn: () => requestJson<QueueStatusResponse>(`/api/v1/orders/${encodeURIComponent(orderId)}/status`),
    enabled: Boolean(orderId),
    refetchInterval: (query) =>
      query.state.data?.status === "PICKED_UP" ? false : 3_000
  });
}

export function useFulfillments(statuses: OrderStatus[] = ["PREPARING", "READY"]) {
  return useQuery({
    queryKey: ["fulfillments", statuses],
    queryFn: () =>
      requestJson<StaffOrder[]>(
        `/api/v1/fulfillments?status=${encodeURIComponent(statuses.join(","))}`
      ),
    refetchInterval: 2_000
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: UpdateOrderStatusRequest & { orderId: string }) =>
      requestJson<StaffOrder>(`/api/v1/fulfillments/${encodeURIComponent(orderId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status } satisfies UpdateOrderStatusRequest)
      }),
    onSuccess: (order) => {
      queryClient.setQueryData(["queue-status", order.orderId], order);
      void queryClient.invalidateQueries({ queryKey: ["fulfillments"] });
    }
  });
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => requestJson<AuthSession>("/api/v1/auth/me"),
    retry: false
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) => requestJson<AuthSession>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
    onSuccess: (session) => queryClient.setQueryData(["session"], session)
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestJson<{ success: boolean }>("/api/v1/auth/logout", { method: "POST" }),
    onSuccess: () => queryClient.removeQueries({ queryKey: ["session"] })
  });
}

export function useInventory() {
  return useQuery({ queryKey: ["inventory"], queryFn: () => requestJson<InventorySnapshot>("/api/v1/inventory") });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { flavorId: string; batchCode: string; portions: number; producedAt: string; expiresAt: string }) =>
      requestJson<InventoryBatch>("/api/v1/inventory/batches", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["inventory"] }); void queryClient.invalidateQueries({ queryKey: ["catalog"] }); }
  });
}

export function useUpdateFlavorInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flavorId, ...input }: { flavorId: string; availablePortions: number; allergens: string[] }) =>
      requestJson<Flavor>(`/api/v1/inventory/flavors/${encodeURIComponent(flavorId)}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["inventory"] }); void queryClient.invalidateQueries({ queryKey: ["catalog"] }); }
  });
}

export function useRecordWaste() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { batchId: string; portions: number; reason: string }) =>
      requestJson<WasteRecord>("/api/v1/inventory/waste", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    }
  });
}

export function useAnalytics() {
  return useQuery({ queryKey: ["analytics"], queryFn: () => requestJson<AnalyticsSummary>("/api/v1/analytics/summary") });
}
