import { authErrorResponse, requireAuth } from "@/lib/auth";
import { MockApiError, updateFlavorInventory } from "@/lib/mock-db";

export async function PATCH(request: Request, { params }: { params: Promise<{ flavorId: string }> }) {
  try {
    await requireAuth(request, ["MANAGER"]);
    const { flavorId } = await params;
    return Response.json(updateFlavorInventory(flavorId, await request.json()));
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof MockApiError) return Response.json(error.payload, { status: error.status });
    return Response.json({ code: "INVALID_JSON", message: "ข้อมูลสินค้าไม่ถูกต้อง" }, { status: 400 });
  }
}
