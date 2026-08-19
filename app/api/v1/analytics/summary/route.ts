import { authErrorResponse, requireAuth } from "@/lib/auth";
import { analyticsSummary } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAuth(request, ["MANAGER"]);
    return Response.json(analyticsSummary(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ code: "ANALYTICS_ERROR", message: "โหลดรายงานไม่สำเร็จ" }, { status: 500 });
  }
}
