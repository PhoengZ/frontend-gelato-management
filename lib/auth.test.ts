import { describe, expect, it } from "vitest";
import { authenticateDemoUser, createSessionToken, requireAuth, verifySessionToken } from "@/lib/auth";

describe("JWT auth and RBAC", () => {
  it("creates and verifies a signed JWT session", async () => {
    const user = authenticateDemoUser("staff@gelatte.test", "staff123");
    expect(user?.role).toBe("STAFF");
    const { token } = await createSessionToken(user!);
    expect((await verifySessionToken(token))?.user.email).toBe("staff@gelatte.test");
    expect(await verifySessionToken(`${token.slice(0, -1)}x`)).toBeNull();
  });

  it("rejects a staff token from manager-only resources", async () => {
    const user = authenticateDemoUser("staff@gelatte.test", "staff123")!;
    const { token } = await createSessionToken(user);
    const request = new Request("http://localhost/api/v1/inventory", { headers: { Cookie: `gelatte_session=${token}` } });
    await expect(requireAuth(request, ["MANAGER"])).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});
