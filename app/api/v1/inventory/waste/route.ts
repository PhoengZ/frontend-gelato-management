import { authErrorResponse, requireAuth } from "@/lib/auth";
import { MockApiError, recordWaste } from "@/lib/mock-db";

export async function POST(request: Request) {
  try {
    await requireAuth(request, ["MANAGER"]);
    return Response.json(recordWaste(await request.json()), { status: 201 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof MockApiError) return Response.json(error.payload, { status: error.status });
    return Response.json({ code: "INVALID_JSON", message: "ข้อมูลของเสียไม่ถูกต้อง" }, { status: 400 });
  }
}
