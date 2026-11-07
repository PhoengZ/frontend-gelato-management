// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";

const user = { id: "c1", email: "a@example.com", display_name: "A", role: "CUSTOMER", status: "ACTIVE", created_at: "2026-10-25T00:00:00Z" };

function request(path: string, headers: Record<string, string>, body?: string) {
  return new Request(`http://localhost:3000/api/v1/auth/${path}`, { method: "POST", headers, body });
}

describe("auth routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("API_GATEWAY_URL", "http://gateway:8080");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ access_token: "t", token_type: "Bearer", expires_in: 900, user }), { status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("rejects a cross-site text/plain login form before changing the session", async () => {
    const response = await login(request("login", { "content-type": "text/plain", origin: "https://attacker.invalid", "sec-fetch-site": "cross-site" }, "{}"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "CROSS_SITE_REQUEST_REJECTED" });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a login without a JSON content type even with no fetch metadata", async () => {
    const response = await login(request("login", { "content-type": "text/plain" }, "{}"));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a same-origin JSON login and forwards the client IP", async () => {
    const response = await login(request("login", { "content-type": "application/json", origin: "http://localhost:3000", "sec-fetch-site": "same-origin", "x-forwarded-for": "203.0.113.7" }, "{}"));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("gelatte_session=t");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("rejects a cross-site logout and keeps a same-origin one working", async () => {
    const rejected = await logout(request("logout", { "sec-fetch-site": "cross-site" }));
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("set-cookie")).toBeNull();
    const accepted = await logout(request("logout", {}));
    expect(accepted.status).toBe(204);
    expect(accepted.headers.get("set-cookie")).toContain("gelatte_session=");
  });
});
