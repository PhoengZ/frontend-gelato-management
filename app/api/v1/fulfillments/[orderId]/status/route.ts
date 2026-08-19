import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import { MockApiError, publicOrder, updateMockOrder } from "@/lib/mock-db";
import type { UpdateOrderStatusRequest } from "@/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    await requireAuth(request, ["STAFF", "MANAGER"]);
    const { orderId } = await params;
    const body = (await request.json()) as UpdateOrderStatusRequest;
    if (body.status !== "READY" && body.status !== "PICKED_UP") {
      return NextResponse.json(
        { code: "INVALID_STATUS", message: "สถานะที่ส่งมาไม่ถูกต้อง" },
        { status: 400 }
      );
    }
    return NextResponse.json(publicOrder(updateMockOrder(orderId, body)));
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof MockApiError) {
      return NextResponse.json(error.payload, { status: error.status });
    }
    return NextResponse.json(
      { code: "INVALID_JSON", message: "ไม่สามารถอ่านข้อมูลสถานะได้" },
      { status: 400 }
    );
  }
}
