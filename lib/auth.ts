import type { AuthSession, AuthUser, UserRole } from "@/types";

export const AUTH_COOKIE = "gelatte_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 8;
const encoder = new TextEncoder();

type StoredUser = AuthUser & { password: string };

const demoUsers: StoredUser[] = [
  { id: "customer-1", name: "Gelatte Customer", email: "customer@gelatte.test", password: "customer123", role: "CUSTOMER" },
  { id: "staff-1", name: "Counter Staff", email: "staff@gelatte.test", password: "staff123", role: "STAFF" },
  { id: "manager-1", name: "Store Manager", email: "manager@gelatte.test", password: "manager123", role: "MANAGER" }
];

declare global {
  var __gelatoFlowRegisteredUsers: StoredUser[] | undefined;
}

const registeredUsers = globalThis.__gelatoFlowRegisteredUsers ?? (globalThis.__gelatoFlowRegisteredUsers = []);

interface JwtPayload extends AuthUser {
  iat: number;
  exp: number;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, public code: "UNAUTHENTICATED" | "FORBIDDEN", message: string) {
    super(message);
  }
}

function encodeBase64Url(value: string | Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function signingKey() {
  const secret = process.env.JWT_SECRET ?? "gelatte-local-demo-secret-change-before-production";
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(user: AuthUser): Promise<{ token: string; session: AuthSession }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = { ...user, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(unsigned));
  return {
    token: `${unsigned}.${encodeBase64Url(new Uint8Array(signature))}`,
    session: { user, expiresAt: new Date(payload.exp * 1000).toISOString() }
  };
}

export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      Buffer.from(signature, "base64url"),
      encoder.encode(`${header}.${body}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(decodeBase64Url(body)) as JwtPayload;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    const user: AuthUser = { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
    return { user, expiresAt: new Date(payload.exp * 1000).toISOString() };
  } catch {
    return null;
  }
}

export function authenticateDemoUser(email: string, password: string): AuthUser | null {
  const match = [...demoUsers, ...registeredUsers].find((user) => user.email.toLowerCase() === email.trim().toLowerCase() && user.password === password);
  if (!match) return null;
  return { id: match.id, name: match.name, email: match.email, role: match.role };
}

export class RegistrationError extends Error {
  constructor(public code: "INVALID_REGISTRATION" | "EMAIL_EXISTS", message: string) {
    super(message);
  }
}

export function registerCustomer(input: { name: string; email: string; password: string }): AuthUser {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || input.password.length < 8) {
    throw new RegistrationError("INVALID_REGISTRATION", "กรุณากรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษรให้ถูกต้อง");
  }
  if ([...demoUsers, ...registeredUsers].some((user) => user.email.toLowerCase() === email)) {
    throw new RegistrationError("EMAIL_EXISTS", "อีเมลนี้ถูกใช้งานแล้ว");
  }
  const stored: StoredUser = { id: crypto.randomUUID(), name, email, password: input.password, role: "CUSTOMER" };
  registeredUsers.push(stored);
  return { id: stored.id, name: stored.name, email: stored.email, role: stored.role };
}

function tokenFromRequest(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return bearer;
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${AUTH_COOKIE}=`))?.slice(AUTH_COOKIE.length + 1) ?? null;
}

export async function requireAuth(request: Request, roles?: UserRole[]): Promise<AuthSession> {
  const token = tokenFromRequest(request);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) throw new AuthError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบก่อนใช้งาน");
  if (roles && !roles.includes(session.user.role)) throw new AuthError(403, "FORBIDDEN", "บัญชีนี้ไม่มีสิทธิ์ใช้งานส่วนนี้");
  return session;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ code: error.code, message: error.message }, { status: error.status });
  }
  return null;
}
