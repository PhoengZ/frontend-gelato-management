import { authErrorResponse, requireAuth } from "@/lib/auth";
import { deleteFlavor, MockApiError, updateFlavor } from "@/lib/mock-db";

function errorResponse(error: unknown) {
  const authResponse = authErrorResponse(error);
  if (authResponse) return authResponse;
  if (error instanceof MockApiError) return Response.json(error.payload, { status: error.status });
  return Response.json({ code: "INVALID_JSON", message: "ข้อมูลเมนูไม่ถูกต้อง" }, { status: 400 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ flavorId: string }> }) {
  try {
    await requireAuth(request, ["MANAGER"]);
    return Response.json(updateFlavor((await params).flavorId, await request.json()));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ flavorId: string }> }) {
  try {
    await requireAuth(request, ["MANAGER"]);
    return Response.json(deleteFlavor((await params).flavorId));
  } catch (error) {
    return errorResponse(error);
  }
}
