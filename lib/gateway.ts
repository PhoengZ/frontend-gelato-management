import { AUTH_COOKIE, decodeAccessToken, type AccessTokenClaims } from "@/lib/auth";
import type { UserRole } from "@/types";

/** Server-only: the API Gateway origin, e.g. http://localhost:8080. */
export function gatewayUrl() {
  const url = process.env.API_GATEWAY_URL?.replace(/\/$/, "");
  if (!url) throw new Error("API_GATEWAY_URL is not configured");
  return url;
}

/**
 * The Gateway has no route for the notification stream yet, so it can be pointed
 * at the Notification Service directly. Falls back to the Gateway once it is routed there.
 */
function notificationUrl() {
  return process.env.NOTIFICATION_SERVICE_URL?.replace(/\/$/, "") || gatewayUrl();
}

/**
 * Role checks the frontend enforces itself because the owning services do not yet
 * (the Gateway only verifies the token; Fulfillment and Analytics have no role guards).
 */
const roleGuards: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "fulfillments", roles: ["STAFF", "MANAGER"] },
  { prefix: "analytics", roles: ["MANAGER"] }
];

const FORWARDED_REQUEST_HEADERS = ["accept", "content-type", "idempotency-key", "last-event-id"];
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control", "retry-after"];

export function sessionFromRequest(request: Request): { token: string; claims: AccessTokenClaims } | null {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE}=`))
    ?.slice(AUTH_COOKIE.length + 1);
  if (!token) return null;
  const claims = decodeAccessToken(token);
  return claims ? { token, claims } : null;
}

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ code, message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Forwards a browser request to the backend, replacing the session cookie with a Bearer token.
 * An expired or missing session is forwarded anonymously so public reads keep working.
 */
export async function forwardToBackend(request: Request, path: string[]): Promise<Response> {
  const session = sessionFromRequest(request);
  const guard = roleGuards.find(({ prefix }) => path[0] === prefix);
  if (guard) {
    if (!session) return errorResponse(401, "UNAUTHORIZED", "Authentication is required");
    if (!guard.roles.includes(session.claims.role)) return errorResponse(403, "FORBIDDEN", "Insufficient role");
  }

  const origin = path[0] === "notifications" ? notificationUrl() : gatewayUrl();
  const incoming = new URL(request.url);
  const target = `${origin}/api/v1/${path.map(encodeURIComponent).join("/")}${incoming.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (session) headers.set("authorization", `Bearer ${session.token}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      signal: request.signal,
      cache: "no-store",
      redirect: "manual"
    });
  } catch {
    return errorResponse(502, "GATEWAY_UNAVAILABLE", "Backend is unavailable");
  }

  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
