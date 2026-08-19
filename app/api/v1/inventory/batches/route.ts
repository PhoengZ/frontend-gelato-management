import { authErrorResponse, requireAuth } from "@/lib/auth";
import { createInventoryBatch, MockApiError } from "@/lib/mock-db";

export async function POST(request: Request) {
  try {
    await requireAuth(request, ["MANAGER"]);
    return Response.json(createInventoryBatch(await request.json()), { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof MockApiError) return Response.json(error.payload, { status: error.status });
    return Response.json({ code: "INVALID_JSON", message: "ข้อมูล Batch ไม่ถูกต้อง" }, { status: 400 });
  }
}
