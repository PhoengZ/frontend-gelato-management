import { authErrorResponse, requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await requireAuth(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ code: "AUTH_ERROR", message: "ตรวจสอบ session ไม่สำเร็จ" }, { status: 500 });
  }
}
