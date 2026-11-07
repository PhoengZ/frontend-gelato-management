import { NextResponse } from "next/server";
import { AUTH_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { crossSiteRejection } from "@/lib/request-guard";

// Auth has no server-side revocation; logging out only drops the browser's copy of the token.
export async function POST(request: Request) {
  const rejection = crossSiteRejection(request);
  if (rejection) return rejection;

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(AUTH_COOKIE, "", sessionCookieOptions(0));
  return response;
}
