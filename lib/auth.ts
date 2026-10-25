import type { UserRole } from "@/types";

export const AUTH_COOKIE = "gelatte_session";

const ROLES: readonly UserRole[] = ["CUSTOMER", "STAFF", "MANAGER"];

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  exp: number;
}

/**
 * Reads the claims of an Auth Service access token without verifying its signature.
 *
 * The frontend only uses the claims for routing decisions (redirects, role gates, and
 * dropping expired cookies). Every forwarded request is still verified by the API Gateway,
 * so a forged token cannot reach backend data.
 */
export function decodeAccessToken(token: string, nowSeconds = Math.floor(Date.now() / 1000)): AccessTokenClaims | null {
  try {
    const [, body] = token.split(".");
    if (!body) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<AccessTokenClaims>;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (!payload.role || !ROLES.includes(payload.role)) return null;
    if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) return null;
    return { sub: payload.sub, role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    priority: "high" as const
  };
}
