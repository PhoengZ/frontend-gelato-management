export interface Flavor {
  id: string;
  name: string;
  description: string;
  pricePerPortion: number;
  allergens: string[];
  availablePortions: number;
  imageUrl: string;
  isAvailable: boolean;
}

export interface CartItem {
  flavorId: string;
  flavorName: string;
  portions: number;
  unitPrice: number;
}

export interface OrderItemRequest {
  flavorId: string;
  portions: number;
}

export type PaymentMethod = "PROMPTPAY_MOCK";
export type OrderStatus = "PAID" | "PREPARING" | "READY" | "PICKED_UP";

export interface OrderRequest {
  items: OrderItemRequest[];
  paymentMethod: PaymentMethod;
  idempotencyKey: string;
}

export interface OrderResponse {
  orderId: string;
  queueNumber: string;
  status: OrderStatus;
  createdAt: string;
}

export interface QueueStatusResponse extends OrderResponse {
  estimatedWaitMinutes: number;
}

export interface StaffOrderItem {
  flavorId: string;
  flavorName: string;
  portions: number;
}

export interface StaffOrder extends QueueStatusResponse {
  items: StaffOrderItem[];
}

export type FulfillmentStatus = "READY" | "PICKED_UP";

export interface UpdateOrderStatusRequest {
  status: FulfillmentStatus;
}

export interface ApiError {
  message: string;
  code: string;
}

export type UserRole = "CUSTOMER" | "STAFF" | "MANAGER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: string;
}

export interface InventoryBatch {
  id: string;
  batchCode: string;
  flavorId: string;
  flavorName: string;
  producedAt: string;
  expiresAt: string;
  initialPortions: number;
  remainingPortions: number;
}

export interface WasteRecord {
  id: string;
  batchId: string;
  flavorId: string;
  flavorName: string;
  portions: number;
  reason: string;
  createdAt: string;
}

export interface InventorySnapshot {
  flavors: Flavor[];
  batches: InventoryBatch[];
  waste: WasteRecord[];
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  totalScoops: number;
  totalWaste: number;
  salesByFlavor: Array<{ flavorId: string; flavorName: string; portions: number; revenue: number }>;
  wasteByFlavor: Array<{ flavorId: string; flavorName: string; portions: number }>;
  salesTrend: Array<{ date: string; label: string; revenue: number; orders: number; scoops: number }>;
}
