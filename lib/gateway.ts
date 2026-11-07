import { AUTH_COOKIE, decodeAccessToken, type AccessTokenClaims } from "@/lib/auth";
import { crossSiteRejection } from "@/lib/request-guard";
import type { UserRole } from "@/types";

/** Server-only: the API Gateway origin, e.g. http://localhost:8080. */
export function gatewayUrl() {
  const url = process.env.API_GATEWAY_URL?.replace(/\/$/, "");
  if (!url) throw new Error("API_GATEWAY_URL is not configured");
  return url;
}

/**
 * The Gateway routes /api/v1/notifications/stream, so this normally falls back to it.
 * NOTIFICATION_SERVICE_URL remains as an optional override for isolated local testing.
 */
function notificationUrl() {
  return process.env.NOTIFICATION_SERVICE_URL?.replace(/\/$/, "") || gatewayUrl();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Role checks applied here before forwarding, as a first line in front of the owning services.
 * Fulfillment lets a customer read the ticket of their own order (any other ticket is a 404
 * from the service, per contracts/openapi/fulfillment-service.v1.yaml), so only that single GET
 * is open to customers. Store cancellation is a counter action, so it is closed to customers
 * even though the Order Service also checks the role.
 */
function requiredRoles(method: string, path: string[]): UserRole[] | null {
  if (path[0] === "analytics") return ["MANAGER"];
  if (path[0] === "orders" && path[2] === "store-cancel") return ["STAFF", "MANAGER"];
  if (path[0] !== "fulfillments") return null;
  const isTicketRead = method === "GET" && path.length === 2 && UUID.test(path[1]);
  return isTicketRead ? ["CUSTOMER", "STAFF", "MANAGER"] : ["STAFF", "MANAGER"];
}

const FORWARDED_REQUEST_HEADERS = ["accept", "content-type", "idempotency-key", "last-event-id", "x-forwarded-for"];
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
  if (request.method !== "GET" && request.method !== "HEAD") {
    const rejection = crossSiteRejection(request);
    if (rejection) return rejection;
  }

  const session = sessionFromRequest(request);
  const roles = requiredRoles(request.method, path);
  if (roles) {
    if (!session) return errorResponse(401, "UNAUTHORIZED", "Authentication is required");
    if (!roles.includes(session.claims.role)) return errorResponse(403, "FORBIDDEN", "Insufficient role");
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
