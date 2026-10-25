"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AnalyticsPeriod,
  AnalyticsSummary,
  ApiError,
  AvailabilityResponse,
  Batch,
  CheckoutResponse,
  CreateBatchRequest,
  CreateFlavorRequest,
  CreateOrderRequest,
  Flavor,
  Fulfillment,
  FulfillmentStatus,
  InventorySnapshot,
  ListResponse,
  LoginRequest,
  LoginResponse,
  MenuFlavor,
  Order,
  OrderStatus,
  RecordWasteRequest,
  SignUpRequest,
  UpdateFlavorRequest,
  UpdateFulfillmentStatusRequest,
  User,
  WasteRecord
} from "@/types";

// Every call goes to the same-origin Next.js routes, which attach the session token
// and forward to the API Gateway (see app/api/v1/[...path]/route.ts).

const friendlyMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  EMAIL_ALREADY_EXISTS: "อีเมลนี้ถูกใช้งานแล้ว",
  RATE_LIMITED: "มีการเรียกใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  UNAUTHORIZED: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
  UNAUTHENTICATED: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
  FORBIDDEN: "บัญชีนี้ไม่มีสิทธิ์ใช้งานส่วนนี้",
  INSUFFICIENT_STOCK: "สต็อกไม่พอสำหรับรายการนี้",
  DEPENDENCY_CONFLICT: "สต็อกไม่พอหรือเมนูนี้ปิดขายแล้ว กรุณาปรับตะกร้า",
  FLAVOR_INACTIVE: "มีเมนูในตะกร้าที่ปิดขายแล้ว",
  IDEMPOTENCY_KEY_REUSED: "ตะกร้าเปลี่ยนไปจากคำสั่งซื้อเดิม กรุณาลองชำระเงินอีกครั้ง",
  BATCH_CODE_CONFLICT: "รหัส Batch นี้ถูกใช้แล้ว",
  DEPENDENCY_UNAVAILABLE: "บริการที่เกี่ยวข้องไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง",
  DEPENDENCY_TIMEOUT: "บริการที่เกี่ยวข้องตอบสนองช้า กรุณาลองใหม่อีกครั้ง",
  GATEWAY_UNAVAILABLE: "เชื่อมต่อระบบหลังบ้านไม่สำเร็จ"
};

export class ApiClientError extends Error implements ApiError {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, code = "UNKNOWN_ERROR", status = 0, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
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
    const code = error.code ?? `HTTP_${response.status}`;
    throw new ApiClientError(
      friendlyMessages[code] ?? error.message ?? "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง",
      code,
      response.status,
      error.details
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Joins Catalog metadata with Inventory availability; flavors without stock get 0 portions. */
export function withAvailability(flavors: Flavor[], availability: AvailabilityResponse): MenuFlavor[] {
  const portions = new Map(availability.items.map((item) => [item.flavor_id, item.available_portions]));
  return flavors.map((flavor) => ({ ...flavor, available_portions: portions.get(flavor.id) ?? 0 }));
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, keys: string[]) {
  for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
}

// Auth

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => requestJson<User>("/api/v1/auth/me"),
    retry: false
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginRequest) =>
      requestJson<LoginResponse>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
    onSuccess: (session) => queryClient.setQueryData(["session"], session.user)
  });
}

/** Auth signup does not issue a token, so a successful signup is followed by a login. */
export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignUpRequest) => {
      await requestJson<User>("/api/v1/auth/signup", { method: "POST", body: JSON.stringify(input) });
      return requestJson<LoginResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: input.email, password: input.password } satisfies LoginRequest)
      });
    },
    onSuccess: (session) => queryClient.setQueryData(["session"], session.user)
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestJson<void>("/api/v1/auth/logout", { method: "POST" }),
    onSuccess: () => queryClient.clear()
  });
}

// Catalog + availability

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const [flavors, availability] = await Promise.all([
        requestJson<ListResponse<Flavor>>("/api/v1/flavors?active=true"),
        requestJson<AvailabilityResponse>("/api/v1/inventory/availability")
      ]);
      return withAvailability(flavors.items, availability);
    }
  });
}

// Orders

export function useCreateOrder() {
  return useMutation({
    mutationFn: ({ order, idempotencyKey }: { order: CreateOrderRequest; idempotencyKey: string }) =>
      requestJson<CheckoutResponse>("/api/v1/orders", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(order)
      })
  });
}

const settlingStatuses: OrderStatus[] = ["PENDING_PAYMENT", "CANCEL_PENDING", "PAYMENT_CONFIRMING"];
const finalStatuses: OrderStatus[] = ["COMPLETED", "CANCELLED"];

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: () => requestJson<Order>(`/api/v1/orders/${encodeURIComponent(orderId)}`),
    enabled: Boolean(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 3_000;
      if (finalStatuses.includes(status)) return false;
      return settlingStatuses.includes(status) ? 3_000 : 15_000;
    }
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      requestJson<void>(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "CUSTOMER_REQUEST" })
      }),
    onSettled: (_data, _error, orderId) => void queryClient.invalidateQueries({ queryKey: ["order", orderId] })
  });
}

// Fulfillment

export function useFulfillments(statuses: FulfillmentStatus[] = ["PREPARING", "READY_FOR_PICKUP"]) {
  return useQuery({
    queryKey: ["fulfillments", statuses],
    queryFn: async () =>
      (await requestJson<ListResponse<Fulfillment>>(`/api/v1/fulfillments?status=${statuses.join(",")}`)).items,
    refetchInterval: 2_000
  });
}

export function useUpdateFulfillmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: UpdateFulfillmentStatusRequest & { orderId: string }) =>
      requestJson<Fulfillment>(`/api/v1/fulfillments/${encodeURIComponent(orderId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status } satisfies UpdateFulfillmentStatusRequest)
      }),
    onSuccess: () => invalidate(queryClient, ["fulfillments"])
  });
}

// Inventory (manager)

export function useInventory() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async (): Promise<InventorySnapshot> => {
      // A MANAGER token lists archived flavors too, so they can be reactivated.
      const [flavors, batches, availability] = await Promise.all([
        requestJson<ListResponse<Flavor>>("/api/v1/flavors"),
        requestJson<ListResponse<Batch>>("/api/v1/inventory/batches"),
        requestJson<AvailabilityResponse>("/api/v1/inventory/availability")
      ]);
      return { flavors: withAvailability(flavors.items, availability), batches: batches.items };
    }
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBatchRequest) =>
      requestJson<Batch>("/api/v1/inventory/batches", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidate(queryClient, ["inventory", "catalog"])
  });
}

export function useRecordWaste() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, ...input }: RecordWasteRequest & { batchId: string }) =>
      requestJson<WasteRecord>(`/api/v1/inventory/batches/${encodeURIComponent(batchId)}/waste`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    onSuccess: () => invalidate(queryClient, ["inventory", "catalog", "analytics"])
  });
}

// Catalog management (manager)

export function useCreateFlavor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFlavorRequest) =>
      requestJson<Flavor>("/api/v1/flavors", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidate(queryClient, ["inventory", "catalog"])
  });
}

export function useUpdateFlavor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flavorId, ...input }: UpdateFlavorRequest & { flavorId: string }) =>
      requestJson<Flavor>(`/api/v1/flavors/${encodeURIComponent(flavorId)}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => invalidate(queryClient, ["inventory", "catalog", "analytics"])
  });
}

/** Catalog DELETE archives the flavor (active=false); it can be reactivated with PATCH. */
export function useArchiveFlavor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (flavorId: string) => requestJson<void>(`/api/v1/flavors/${encodeURIComponent(flavorId)}`, { method: "DELETE" }),
    onSuccess: () => invalidate(queryClient, ["inventory", "catalog", "analytics"])
  });
}

// Analytics

export function useAnalytics(period: AnalyticsPeriod = "1w") {
  return useQuery({
    queryKey: ["analytics", period],
    queryFn: () => requestJson<AnalyticsSummary>(`/api/v1/analytics/summary?period=${period}`),
    placeholderData: keepPreviousData
  });
}
