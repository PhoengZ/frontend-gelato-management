function requestHost(request: Request) {
  // Caddy keeps the public host in X-Forwarded-Host; the first entry is the one the browser used.
  return request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || new URL(request.url).host;
}

function originMatchesHost(origin: string, host: string) {
  try {
    const parsed = new URL(origin);
    // Parsing the host with the Origin's scheme normalizes a default port such as :443.
    return parsed.host === new URL(`${parsed.protocol}//${host}`).host;
  } catch {
    // Includes the opaque `Origin: null` sent by sandboxed documents.
    return false;
  }
}

function isJson(request: Request) {
  return request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";
}

/**
 * CSRF check for state-changing routes: returns a 403 response for a cross-site request and
 * null otherwise. Clients that send no Origin or Sec-Fetch-Site headers are not browsers
 * carrying someone else's cookies, so they pass. `requireJson` also blocks the CORS-simple
 * content types that a cross-site HTML form can submit without a preflight.
 */
export function crossSiteRejection(request: Request, { requireJson = false }: { requireJson?: boolean } = {}): Response | null {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const crossSite =
    (site !== null && site !== "same-origin" && site !== "none") ||
    (origin !== null && !originMatchesHost(origin, requestHost(request))) ||
    (requireJson && !isJson(request));
  if (!crossSite) return null;
  return Response.json(
    { code: "CROSS_SITE_REQUEST_REJECTED", message: "Cross-site requests are not allowed" },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}
