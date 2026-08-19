import { authErrorResponse, requireAuth } from "@/lib/auth";
import { inventorySnapshot } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAuth(request, ["MANAGER"]);
    return Response.json(inventorySnapshot(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ code: "INVENTORY_ERROR", message: "โหลดคลังสินค้าไม่สำเร็จ" }, { status: 500 });
  }
}
