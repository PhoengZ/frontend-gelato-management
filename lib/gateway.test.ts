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
const staff = token({ sub: "b19b830e-a733-41de-bf26-aeb123926e36", role: "STAFF", exp: future });
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

  describe("customer ticket access", () => {
    const ticket = "8d29d6cf-bd4d-48ca-9e4f-dcd8ec54e594";

    it("opens only the single ticket GET to customers", async () => {
      const response = await forwardToBackend(browserRequest(`fulfillments/${ticket}`, { session: customer }), ["fulfillments", ticket]);
      expect(response.status).toBe(200);
      expect(fetchMock.mock.calls[0][0]).toBe(`http://gateway:8080/api/v1/fulfillments/${ticket}`);
    });

    it("still requires a session for the ticket GET", async () => {
      expect((await forwardToBackend(browserRequest(`fulfillments/${ticket}`), ["fulfillments", ticket])).status).toBe(401);
    });

    it.each([
      ["list", "GET", ["fulfillments"]],
      ["history", "GET", ["fulfillments", ticket, "history"]],
      ["status update", "PATCH", ["fulfillments", ticket, "status"]],
      ["slot capacity", "GET", ["fulfillments", "slots", "capacity"]],
      ["non-UUID segment", "GET", ["fulfillments", "slots"]],
      ["ticket write", "PATCH", ["fulfillments", ticket]]
    ])("keeps %s closed to customers", async (_name, method, path) => {
      const response = await forwardToBackend(browserRequest(path.join("/"), { method, session: customer }), path);
      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps staff access to every fulfillment route", async () => {
      expect((await forwardToBackend(browserRequest("fulfillments", { session: staff }), ["fulfillments"])).status).toBe(200);
      expect((await forwardToBackend(browserRequest(`fulfillments/${ticket}/status`, { method: "PATCH", session: staff }), ["fulfillments", ticket, "status"])).status).toBe(200);
    });
  });

  describe("cross-site protection", () => {
    it("rejects cross-site mutations before contacting the backend", async () => {
      const response = await forwardToBackend(
        browserRequest("orders", { method: "POST", session: customer, headers: { origin: "https://attacker.invalid", "sec-fetch-site": "cross-site" }, body: "{}" }),
        ["orders"]
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CROSS_SITE_REQUEST_REJECTED" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not apply the check to reads", async () => {
      const response = await forwardToBackend(browserRequest("flavors", { headers: { "sec-fetch-site": "cross-site" } }), ["flavors"]);
      expect(response.status).toBe(200);
    });

    it("forwards a same-origin mutation", async () => {
      const response = await forwardToBackend(
        browserRequest("orders", { method: "POST", session: customer, headers: { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }, body: "{}" }),
        ["orders"]
      );
      expect(response.status).toBe(200);
    });
  });

  it("forwards X-Forwarded-For so the Gateway can rate limit by client IP", async () => {
    await forwardToBackend(browserRequest("flavors", { headers: { "x-forwarded-for": "203.0.113.7" } }), ["flavors"]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("x-forwarded-for")).toBe("203.0.113.7");
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
