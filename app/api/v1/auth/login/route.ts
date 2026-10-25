import { NextResponse } from "next/server";
import { AUTH_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { gatewayUrl } from "@/lib/gateway";
import type { LoginResponse, User } from "@/types";

interface AuthTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  user: User;
}

// Exchanges credentials for an Auth Service token and keeps the token in an httpOnly cookie.
export async function POST(request: Request) {
  let upstream: Response;
  try {
    upstream = await fetch(`${gatewayUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      cache: "no-store"
    });
  } catch {
    return NextResponse.json({ code: "GATEWAY_UNAVAILABLE", message: "Backend is unavailable" }, { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" }
    });
  }

  const token = (await upstream.json()) as AuthTokenResponse;
  const response = NextResponse.json({ user: token.user, expires_in: token.expires_in } satisfies LoginResponse, {
    headers: { "Cache-Control": "no-store" }
  });
  response.cookies.set(AUTH_COOKIE, token.access_token, sessionCookieOptions(token.expires_in));
  return response;
}
