import { NextRequest, NextResponse } from "next/server";
import { createMockOrder, MockApiError, publicOrder } from "@/lib/mock-db";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import type { OrderRequest } from "@/types";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, ["CUSTOMER"]);
    const body = (await request.json()) as OrderRequest;
    const order = createMockOrder(body, request.headers.get("X-Idempotency-Key"));
    return NextResponse.json(publicOrder(order), { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof MockApiError) {
      return NextResponse.json(error.payload, { status: error.status });
    }
    return NextResponse.json(
      { code: "INVALID_JSON", message: "ไม่สามารถอ่านข้อมูลคำสั่งซื้อได้" },
      { status: 400 }
    );
  }
}
