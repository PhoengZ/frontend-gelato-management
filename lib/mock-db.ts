import type {
  ApiError,
  AnalyticsSummary,
  Flavor,
  InventoryBatch,
  InventorySnapshot,
  OrderRequest,
  OrderStatus,
  StaffOrder,
  UpdateOrderStatusRequest,
  WasteRecord
} from "@/types";

interface StoredOrder extends StaffOrder {
  requestFingerprint: string;
  idempotencyKey: string;
  totalAmount: number;
}

interface MockDatabase {
  catalogVersion: number;
  flavors: Flavor[];
  orders: Map<string, StoredOrder>;
  idempotency: Map<string, string>;
  nextQueue: number;
  batches: InventoryBatch[];
  waste: WasteRecord[];
}

const CATALOG_VERSION = 3;

const seedFlavors: Flavor[] = [
  {
    id: "pistachio",
    name: "Pistachio Verde",
    description: "พิสตาชิโอคั่วหอม เนื้อเนียนเข้มข้นแบบอิตาเลียน",
    pricePerPortion: 95,
    allergens: ["Nuts", "Dairy"],
    availablePortions: 18,
    imageUrl: "/hero/4.png",
    isAvailable: true
  },
  {
    id: "strawberry",
    name: "Strawberry Cloud",
    description: "สตรอว์เบอร์รีสดอมเปรี้ยว หวานน้อย สดชื่น",
    pricePerPortion: 85,
    allergens: ["Dairy"],
    availablePortions: 24,
    imageUrl: "/hero/5.png",
    isAvailable: true
  },
  {
    id: "vanilla",
    name: "Madagascar Vanilla",
    description: "วานิลลาแท้หอมละมุน คลาสสิกที่เข้ากับทุกวัน",
    pricePerPortion: 85,
    allergens: ["Dairy"],
    availablePortions: 20,
    imageUrl: "/hero/6.png",
    isAvailable: true
  }
];

const seedBatches: InventoryBatch[] = seedFlavors.map((flavor, index) => ({
  id: `batch-${index + 1}`,
  batchCode: `GLT-2608-${String(index + 1).padStart(2, "0")}`,
  flavorId: flavor.id,
  flavorName: flavor.name,
  producedAt: "2026-08-17",
  expiresAt: "2026-08-24",
  initialPortions: flavor.availablePortions,
  remainingPortions: flavor.availablePortions
}));

declare global {
  var __gelatoFlowMockDb: MockDatabase | undefined;
}

export const mockDb: MockDatabase =
  globalThis.__gelatoFlowMockDb ??
  (globalThis.__gelatoFlowMockDb = {
    catalogVersion: CATALOG_VERSION,
    flavors: structuredClone(seedFlavors),
    orders: new Map(),
    idempotency: new Map(),
    nextQueue: 1,
    batches: structuredClone(seedBatches),
    waste: []
  });

if (mockDb.catalogVersion !== CATALOG_VERSION) {
  mockDb.catalogVersion = CATALOG_VERSION;
  mockDb.flavors = structuredClone(seedFlavors);
  mockDb.batches = structuredClone(seedBatches);
  mockDb.waste = [];
}

mockDb.batches ??= structuredClone(seedBatches);
mockDb.waste ??= [];

export class MockApiError extends Error {
  constructor(
    public status: number,
    public payload: ApiError
  ) {
    super(payload.message);
  }
}

export function createMockOrder(request: OrderRequest, headerKey: string | null): StoredOrder {
  if (!headerKey || headerKey !== request.idempotencyKey) {
    throw new MockApiError(409, {
      code: "IDEMPOTENCY_KEY_MISMATCH",
      message: "รหัสยืนยันรายการไม่ตรงกัน กรุณาเริ่มชำระเงินใหม่"
    });
  }

  if (!request.items.length || request.paymentMethod !== "PROMPTPAY_MOCK") {
    throw new MockApiError(400, { code: "INVALID_ORDER", message: "ข้อมูลคำสั่งซื้อไม่ถูกต้อง" });
  }

  const fingerprint = JSON.stringify({ items: request.items, paymentMethod: request.paymentMethod });
  const existingId = mockDb.idempotency.get(headerKey);
  if (existingId) {
    const existing = mockDb.orders.get(existingId)!;
    if (existing.requestFingerprint !== fingerprint) {
      throw new MockApiError(409, {
        code: "IDEMPOTENCY_CONFLICT",
        message: "รหัสรายการนี้ถูกใช้กับตะกร้าอื่นแล้ว"
      });
    }
    return existing;
  }

  const requested = new Map<string, number>();
  for (const item of request.items) {
    if (!Number.isInteger(item.portions) || item.portions <= 0) {
      throw new MockApiError(400, { code: "INVALID_PORTIONS", message: "จำนวน Gelato ไม่ถูกต้อง" });
    }
    requested.set(item.flavorId, (requested.get(item.flavorId) ?? 0) + item.portions);
  }

  const lineItems = Array.from(requested, ([flavorId, portions]) => {
    const flavor = mockDb.flavors.find((entry) => entry.id === flavorId);
    if (!flavor || !flavor.isAvailable || flavor.availablePortions < portions) {
      throw new MockApiError(400, {
        code: "OUT_OF_STOCK",
        message: `${flavor?.name ?? "บางรสชาติ"} มีจำนวนไม่พอ กรุณาปรับตะกร้าแล้วลองใหม่`
      });
    }
    return { flavor, portions };
  });

  for (const { flavor, portions } of lineItems) {
    flavor.availablePortions -= portions;
    flavor.isAvailable = flavor.availablePortions > 0;
    let remaining = portions;
    const batches = mockDb.batches
      .filter((batch) => batch.flavorId === flavor.id && batch.remainingPortions > 0)
      .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt));
    for (const batch of batches) {
      const consumed = Math.min(batch.remainingPortions, remaining);
      batch.remainingPortions -= consumed;
      remaining -= consumed;
      if (remaining === 0) break;
    }
  }

  const queue = mockDb.nextQueue++;
  const orderId = crypto.randomUUID();
  const order: StoredOrder = {
    orderId,
    queueNumber: `A-${String(queue).padStart(3, "0")}`,
    status: "PREPARING",
    createdAt: new Date().toISOString(),
    estimatedWaitMinutes: Math.max(3, mockDb.orders.size * 2 + 5),
    items: lineItems.map(({ flavor, portions }) => ({
      flavorId: flavor.id,
      flavorName: flavor.name,
      portions
    })),
    idempotencyKey: headerKey,
    requestFingerprint: fingerprint,
    totalAmount: lineItems.reduce((sum, { flavor, portions }) => sum + flavor.pricePerPortion * portions, 0)
  };
  mockDb.orders.set(orderId, order);
  mockDb.idempotency.set(headerKey, orderId);
  return order;
}

export function inventorySnapshot(): InventorySnapshot {
  return {
    flavors: structuredClone(mockDb.flavors),
    batches: structuredClone(mockDb.batches).sort((a, b) => b.producedAt.localeCompare(a.producedAt)),
    waste: structuredClone(mockDb.waste).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  };
}

export function createInventoryBatch(input: { flavorId: string; batchCode: string; portions: number; producedAt: string; expiresAt: string }): InventoryBatch {
  const flavor = mockDb.flavors.find((entry) => entry.id === input.flavorId);
  if (!flavor || !input.batchCode.trim() || !Number.isInteger(input.portions) || input.portions <= 0 || !input.producedAt || !input.expiresAt) {
    throw new MockApiError(400, { code: "INVALID_BATCH", message: "ข้อมูล Batch ไม่ถูกต้อง" });
  }
  if (input.expiresAt < input.producedAt) throw new MockApiError(400, { code: "INVALID_EXPIRY", message: "วันหมดอายุต้องไม่น้อยกว่าวันผลิต" });
  const batch: InventoryBatch = {
    id: crypto.randomUUID(), batchCode: input.batchCode.trim(), flavorId: flavor.id, flavorName: flavor.name,
    producedAt: input.producedAt, expiresAt: input.expiresAt, initialPortions: input.portions, remainingPortions: input.portions
  };
  mockDb.batches.unshift(batch);
  flavor.availablePortions += input.portions;
  flavor.isAvailable = true;
  return structuredClone(batch);
}

export function updateFlavorInventory(flavorId: string, input: { availablePortions?: number; allergens?: string[] }): Flavor {
  const flavor = mockDb.flavors.find((entry) => entry.id === flavorId);
  if (!flavor) throw new MockApiError(404, { code: "FLAVOR_NOT_FOUND", message: "ไม่พบรสชาตินี้" });
  if (input.availablePortions !== undefined) {
    if (!Number.isInteger(input.availablePortions) || input.availablePortions < 0) throw new MockApiError(400, { code: "INVALID_STOCK", message: "จำนวนสต็อกไม่ถูกต้อง" });
    flavor.availablePortions = input.availablePortions;
    flavor.isAvailable = input.availablePortions > 0;
  }
  if (input.allergens !== undefined) flavor.allergens = Array.from(new Set(input.allergens.map((item) => item.trim()).filter(Boolean)));
  return structuredClone(flavor);
}

export function recordWaste(input: { batchId: string; portions: number; reason: string }): WasteRecord {
  const batch = mockDb.batches.find((entry) => entry.id === input.batchId);
  if (!batch || !Number.isInteger(input.portions) || input.portions <= 0 || !input.reason.trim()) {
    throw new MockApiError(400, { code: "INVALID_WASTE", message: "ข้อมูลของเสียไม่ถูกต้อง" });
  }
  if (batch.remainingPortions < input.portions) throw new MockApiError(409, { code: "WASTE_EXCEEDS_BATCH", message: "จำนวนของเสียมากกว่าสต็อกใน Batch" });
  const flavor = mockDb.flavors.find((entry) => entry.id === batch.flavorId)!;
  batch.remainingPortions -= input.portions;
  flavor.availablePortions = Math.max(0, flavor.availablePortions - input.portions);
  flavor.isAvailable = flavor.availablePortions > 0;
  const waste: WasteRecord = {
    id: crypto.randomUUID(), batchId: batch.id, flavorId: flavor.id, flavorName: flavor.name,
    portions: input.portions, reason: input.reason.trim(), createdAt: new Date().toISOString()
  };
  mockDb.waste.unshift(waste);
  return structuredClone(waste);
}

export function analyticsSummary(): AnalyticsSummary {
  const orders = Array.from(mockDb.orders.values());
  const sales = new Map<string, { flavorName: string; portions: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const flavor = mockDb.flavors.find((entry) => entry.id === item.flavorId);
      const current = sales.get(item.flavorId) ?? { flavorName: item.flavorName, portions: 0, revenue: 0 };
      current.portions += item.portions;
      current.revenue += item.portions * (flavor?.pricePerPortion ?? 0);
      sales.set(item.flavorId, current);
    }
  }
  const waste = new Map<string, { flavorName: string; portions: number }>();
  for (const item of mockDb.waste) {
    const current = waste.get(item.flavorId) ?? { flavorName: item.flavorName, portions: 0 };
    current.portions += item.portions;
    waste.set(item.flavorId, current);
  }
  return {
    totalRevenue: orders.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0),
    totalOrders: orders.length,
    totalScoops: orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.portions, 0), 0),
    totalWaste: mockDb.waste.reduce((sum, item) => sum + item.portions, 0),
    salesByFlavor: Array.from(sales, ([flavorId, value]) => ({ flavorId, ...value })),
    wasteByFlavor: Array.from(waste, ([flavorId, value]) => ({ flavorId, ...value }))
  };
}

export function updateMockOrder(orderId: string, request: UpdateOrderStatusRequest): StoredOrder {
  const order = mockDb.orders.get(orderId);
  if (!order) {
    throw new MockApiError(404, { code: "ORDER_NOT_FOUND", message: "ไม่พบคำสั่งซื้อนี้" });
  }

  const valid =
    (order.status === "PREPARING" && request.status === "READY") ||
    (order.status === "READY" && request.status === "PICKED_UP");
  if (!valid) {
    throw new MockApiError(409, {
      code: "INVALID_STATUS_TRANSITION",
      message: `ไม่สามารถเปลี่ยนสถานะจาก ${order.status} เป็น ${request.status}`
    });
  }

  order.status = request.status;
  order.estimatedWaitMinutes = 0;
  return order;
}

export function publicOrder(order: StoredOrder): StaffOrder {
  return {
    orderId: order.orderId,
    queueNumber: order.queueNumber,
    status: order.status,
    createdAt: order.createdAt,
    estimatedWaitMinutes: order.estimatedWaitMinutes,
    items: order.items
  };
}

export function parseStatuses(value: string | null): OrderStatus[] {
  const allowed: OrderStatus[] = ["PAID", "PREPARING", "READY", "PICKED_UP"];
  if (!value) return ["PREPARING", "READY"];
  return value.split(",").filter((status): status is OrderStatus => allowed.includes(status as OrderStatus));
}
