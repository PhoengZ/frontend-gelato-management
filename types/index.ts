// Wire types mirror the backend contracts in backend-gelato-management/contracts/openapi.
// JSON is snake_case, IDs are UUIDs and money is integer minor units (satang).

export type Currency = "THB";

export interface Money {
  amount_minor: number;
  currency: Currency;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Auth Service

export type UserRole = "CUSTOMER" | "STAFF" | "MANAGER";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  status: "ACTIVE" | "DISABLED";
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignUpRequest extends LoginRequest {
  display_name: string;
}

/** Returned by the frontend login route; the access token stays in an httpOnly cookie. */
export interface LoginResponse {
  user: User;
  expires_in: number;
}

// Catalog Service

export const ALLERGENS = ["MILK", "EGG", "PEANUT", "TREE_NUT", "SOY", "GLUTEN"] as const;
export type Allergen = (typeof ALLERGENS)[number];

export interface Flavor {
  id: string;
  name: string;
  description: string;
  price: Money;
  image_url?: string;
  allergens: Allergen[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateFlavorRequest {
  name: string;
  description: string;
  price: Money;
  image_url?: string;
  allergens: Allergen[];
  recipe: string;
  active?: boolean;
}

export type UpdateFlavorRequest = Partial<CreateFlavorRequest>;

export interface ListResponse<T> {
  items: T[];
}

// Batch Inventory Service

export interface FlavorAvailability {
  flavor_id: string;
  available_portions: number;
  earliest_expiry?: string;
}

export interface AvailabilityResponse extends ListResponse<FlavorAvailability> {
  as_of: string;
}

export type BatchStatus = "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "ARCHIVED";

export interface Batch {
  id: string;
  batch_code: string;
  flavor_id: string;
  production_date: string;
  expires_at: string;
  initial_portions: number;
  available_portions: number;
  reserved_portions: number;
  sold_portions: number;
  wasted_portions: number;
  unit_cost_minor: number;
  currency: Currency;
  status: BatchStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateBatchRequest {
  batch_code?: string;
  flavor_id: string;
  production_date: string;
  expires_at: string;
  initial_portions: number;
  unit_cost_minor: number;
  currency: Currency;
}

export const WASTE_REASONS = ["EXPIRED", "DAMAGED", "QUALITY", "ADJUSTMENT"] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

export interface RecordWasteRequest {
  portions: number;
  reason: WasteReason;
  note?: string;
  idempotency_key: string;
}

export interface WasteRecord {
  id: string;
  batch_id: string;
  flavor_id: string;
  portions: number;
  reason: WasteReason;
  note?: string;
  cost_lost_minor: number;
  currency: Currency;
  recorded_at: string;
}

// Order Service

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "CANCEL_PENDING"
  | "PAYMENT_CONFIRMING"
  | "PAID"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "CANCELLED";

export interface CreateOrderRequest {
  pickup_at: string;
  items: Array<{ flavor_id: string; portions: number }>;
}

export interface OrderItem {
  flavor_id: string;
  flavor_name: string;
  portions: number;
  unit_price_minor: number;
  subtotal_minor: number;
}

export interface Order {
  order_id: string;
  customer_id: string;
  pickup_at: string;
  status: OrderStatus;
  reservation_expires_at: string;
  total_amount_minor: number;
  currency: Currency;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

/** Create-order response; checkout_url is present only for a payable PENDING_PAYMENT order. */
export interface CheckoutResponse extends Order {
  checkout_url?: string;
}

// Fulfillment Service

export type FulfillmentStatus = "PREPARING" | "READY_FOR_PICKUP" | "PICKED_UP" | "CANCELLED";

export interface FulfillmentItem {
  flavor_id: string;
  flavor_name: string;
  portions: number;
}

export interface Fulfillment {
  id: string;
  order_id: string;
  queue_number: string;
  pickup_slot_id: string;
  pickup_at: string;
  status: FulfillmentStatus;
  items: FulfillmentItem[];
  picked_up_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateFulfillmentStatusRequest {
  status: "READY_FOR_PICKUP" | "PICKED_UP";
}

// Notification Service (SSE)

export type NotificationType =
  | "order.confirmed"
  | "order.ready"
  | "order.cancelled"
  | "inventory.low_stock"
  | "inventory.expiring";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  occurred_at: string;
  data: {
    order_id?: string;
    queue_number?: string;
    pickup_at?: string;
    reason?: string;
    [key: string]: unknown;
  };
}

// Analytics Service (still exposes the legacy camelCase summary; revenue is in baht)

export type AnalyticsPeriod = "1d" | "1w" | "1m" | "6m";

export interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  totalScoops: number;
  totalWaste: number;
  salesByFlavor: Array<{ flavorId: string; flavorName: string; portions: number; revenue: number }>;
  wasteByFlavor: Array<{ flavorId: string; flavorName: string; portions: number }>;
  salesTrend: Array<{ date: string; label: string; revenue: number; orders: number; scoops: number }>;
}

// Frontend view models composed from several services

/** Catalog metadata joined with Inventory availability. */
export interface MenuFlavor extends Flavor {
  available_portions: number;
}

export interface InventorySnapshot {
  flavors: MenuFlavor[];
  batches: Batch[];
}

export interface CartItem {
  flavorId: string;
  flavorName: string;
  portions: number;
  unitPriceMinor: number;
}
