import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";
import type { UserRole } from "@/types";

const permissions: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/staff", roles: ["STAFF", "MANAGER"] },
  { prefix: "/manager", roles: ["MANAGER"] },
  { prefix: "/analytics", roles: ["MANAGER"] }
];

export async function proxy(request: NextRequest) {
  const rule = permissions.find(({ prefix }) => request.nextUrl.pathname.startsWith(prefix));
  if (!rule) return NextResponse.next();
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  if (!rule.roles.includes(session.user.role)) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/staff/:path*", "/manager/:path*", "/analytics/:path*"] };
