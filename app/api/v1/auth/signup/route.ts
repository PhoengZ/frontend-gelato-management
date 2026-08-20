import { NextResponse } from "next/server";
import { AUTH_COOKIE, createSessionToken, registerCustomer, RegistrationError } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { name?: string; email?: string; password?: string };
    const user = registerCustomer({ name: input.name ?? "", email: input.email ?? "", password: input.password ?? "" });
    const { token, session } = await createSessionToken(user);
    const response = NextResponse.json(session, { status: 201 });
    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8, priority: "high"
    });
    return response;
  } catch (error) {
    if (error instanceof RegistrationError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.code === "EMAIL_EXISTS" ? 409 : 400 });
    return NextResponse.json({ code: "INVALID_JSON", message: "ข้อมูลสมัครสมาชิกไม่ถูกต้อง" }, { status: 400 });
  }
}
