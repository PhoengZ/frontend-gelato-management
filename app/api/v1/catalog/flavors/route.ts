import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import { createFlavor, mockDb, MockApiError } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(mockDb.flavors, {
    headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(request: Request) {
  try {
    await requireAuth(request, ["MANAGER"]);
    return NextResponse.json(createFlavor(await request.json()), { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof MockApiError) return NextResponse.json(error.payload, { status: error.status });
    return NextResponse.json({ code: "INVALID_JSON", message: "ข้อมูลเมนูไม่ถูกต้อง" }, { status: 400 });
  }
}
