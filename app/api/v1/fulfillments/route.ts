import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import { mockDb, parseStatuses, publicOrder } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, ["STAFF", "MANAGER"]);
    const statuses = parseStatuses(request.nextUrl.searchParams.get("status"));
    const orders = Array.from(mockDb.orders.values())
      .filter((order) => statuses.includes(order.status))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(publicOrder);
    return NextResponse.json(orders, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ code: "FULFILLMENT_ERROR", message: "โหลดคิวไม่สำเร็จ" }, { status: 500 });
  }
}
