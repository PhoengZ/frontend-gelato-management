// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeAccessToken } from "@/lib/auth";
import { forwardToBackend } from "@/lib/gateway";

function token(claims: Record<string, unknown>) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.signature`;
}

const future = Math.floor(Date.now() / 1000) + 600;
const customer = token({ sub: "c19b830e-a733-41de-bf26-aeb123926e36", role: "CUSTOMER", exp: future });
const manager = token({ sub: "a19b830e-a733-41de-bf26-aeb123926e36", role: "MANAGER", exp: future });

function browserRequest(path: string, init: RequestInit & { session?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.session) headers.set("cookie", `theme=dark; gelatte_session=${init.session}`);
  return new Request(`http://localhost:3000/api/v1/${path}`, { ...init, headers });
}

describe("decodeAccessToken", () => {
  it("reads Auth Service claims", () => {
    expect(decodeAccessToken(customer)).toMatchObject({ role: "CUSTOMER", exp: future });
  });

  it("rejects expired, malformed, or unknown-role tokens", () => {
    expect(decodeAccessToken(token({ sub: "u", role: "CUSTOMER", exp: 1 }))).toBeNull();
    expect(decodeAccessToken(token({ sub: "u", role: "ADMIN", exp: future }))).toBeNull();
    expect(decodeAccessToken("not-a-jwt")).toBeNull();
  });
});

describe("forwardToBackend", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("API_GATEWAY_URL", "http://gateway:8080/");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json", "set-cookie": "x=y" } }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("turns the session cookie into a Bearer token and keeps the query string", async () => {
    const response = await forwardToBackend(browserRequest("flavors?active=true", { session: customer }), ["flavors"]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://gateway:8080/api/v1/flavors?active=true");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${customer}`);
    expect(headers.get("cookie")).toBeNull();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("forwards the body and Idempotency-Key for mutations", async () => {
    await forwardToBackend(
      browserRequest("orders", { method: "POST", session: customer, headers: { "Idempotency-Key": "k-1", "Content-Type": "application/json" }, body: "{\"items\":[]}" }),
      ["orders"]
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("idempotency-key")).toBe("k-1");
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe("{\"items\":[]}");
  });

  it("drops an expired session so public reads stay anonymous", async () => {
    const expired = token({ sub: "u", role: "CUSTOMER", exp: 1 });
    await forwardToBackend(browserRequest("inventory/availability", { session: expired }), ["inventory", "availability"]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("authorization")).toBe(false);
  });

  it("enforces roles the Fulfillment and Analytics services do not check", async () => {
    expect((await forwardToBackend(browserRequest("analytics/summary"), ["analytics", "summary"])).status).toBe(401);
    expect((await forwardToBackend(browserRequest("fulfillments", { session: customer }), ["fulfillments"])).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await forwardToBackend(browserRequest("analytics/summary", { session: manager }), ["analytics", "summary"])).status).toBe(200);
  });

  it("routes the notification stream to the Notification Service when configured", async () => {
    vi.stubEnv("NOTIFICATION_SERVICE_URL", "http://notification:3008");
    await forwardToBackend(browserRequest("notifications/stream", { session: customer }), ["notifications", "stream"]);
    expect(fetchMock.mock.calls[0][0]).toBe("http://notification:3008/api/v1/notifications/stream");
  });

  it("reports an unreachable gateway as 502", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const response = await forwardToBackend(browserRequest("flavors"), ["flavors"]);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "GATEWAY_UNAVAILABLE" });
  });
});
