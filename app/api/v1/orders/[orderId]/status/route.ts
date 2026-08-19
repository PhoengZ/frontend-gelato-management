import { NextResponse } from "next/server";
import { mockDb, publicOrder } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = mockDb.orders.get(orderId);
  if (!order) {
    return NextResponse.json(
      { code: "ORDER_NOT_FOUND", message: "ไม่พบคำสั่งซื้อนี้" },
      { status: 404 }
    );
  }
  return NextResponse.json(publicOrder(order), {
    headers: { "Cache-Control": "no-store" }
  });
}
