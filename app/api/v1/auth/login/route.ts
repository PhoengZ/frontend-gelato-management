import { NextResponse } from "next/server";
import { AUTH_COOKIE, authenticateDemoUser, createSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const user = authenticateDemoUser(body.email ?? "", body.password ?? "");
    if (!user) return NextResponse.json({ code: "INVALID_CREDENTIALS", message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    const { token, session } = await createSessionToken(user);
    const response = NextResponse.json(session);
    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8, priority: "high"
    });
    return response;
  } catch {
    return NextResponse.json({ code: "INVALID_JSON", message: "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง" }, { status: 400 });
  }
}
