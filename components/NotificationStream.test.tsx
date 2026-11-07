import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerNotification } from "@/components/CustomerNotification";
import { NotificationStream } from "@/components/NotificationStream";
import { useLogin, useLogout } from "@/lib/api";
import { useCartStore } from "@/store/useCartStore";
import { useNotificationStore } from "@/store/useNotificationStore";

class FakeEventSource {
  static CLOSED = 2;
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, (event: MessageEvent<string>) => void>();
  readyState = 1;
  closed = false;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, listener);
  }
  close() {
    this.closed = true;
  }
  emit(id: string) {
    const data = JSON.stringify({ id, type: "order.ready", message: "ready", occurred_at: "2026-11-07T10:00:00Z", data: { order_id: "order-a" } });
    this.listeners.get("order.ready")?.({ data } as MessageEvent<string>);
  }
}

const userA = { id: "user-a", email: "a@example.com", display_name: "A", role: "CUSTOMER", status: "ACTIVE", created_at: "2026-10-25T00:00:00Z" };
const userB = { ...userA, id: "user-b", email: "b@example.com", display_name: "B" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function Controls() {
  const logout = useLogout();
  const login = useLogin();
  return (
    <>
      <button onClick={() => logout.mutate()}>logout</button>
      <button onClick={() => login.mutate({ email: "b@example.com", password: "x" })}>login-b</button>
    </>
  );
}

function renderStream() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<><NotificationStream /><Controls /></>, { wrapper });
}

describe("NotificationStream", () => {
  let me: () => Response;

  beforeEach(() => {
    localStorage.clear();
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    useCartStore.setState({ items: [], checkout: null, ownerId: null, activeOrderId: null });
    useNotificationStore.setState({ notifications: [], ownerId: null });
    me = () => json(userA);
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/v1/auth/me") return Promise.resolve(me());
      if (url === "/api/v1/auth/logout") { me = () => json({ code: "UNAUTHORIZED" }, 401); return Promise.resolve(new Response(null, { status: 204 })); }
      if (url === "/api/v1/auth/login") { me = () => json(userB); return Promise.resolve(json({ user: userB, expires_in: 900 })); }
      return Promise.resolve(json({}, 404));
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("opens one stream for a customer without any header mounted", async () => {
    renderStream();
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    expect(FakeEventSource.instances[0].url).toBe("/api/v1/notifications/stream");
    act(() => FakeEventSource.instances[0].emit("e1"));
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });

  it("opens no stream for staff", async () => {
    me = () => json({ ...userA, role: "STAFF" });
    renderStream();
    await waitFor(() => expect(useCartStore.getState().ownerId).toBe("user-a"));
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("leaves the bell without a stream of its own", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CustomerNotification /></QueryClientProvider>);
    await screen.findByRole("button", { name: /แจ้งเตือนสถานะคิว/ });
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("closes the stream on logout, clears the stores, and ignores late frames", async () => {
    useCartStore.setState({ items: [{ flavorId: "v", flavorName: "Vanilla", portions: 1, unitPriceMinor: 8500 }] });
    renderStream();
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0];

    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => expect(source.closed).toBe(true));
    expect(useCartStore.getState()).toMatchObject({ items: [], ownerId: null });
    act(() => source.emit("late"));
    expect(useNotificationStore.getState().notifications).toEqual([]);
    // The logged-out session must not re-adopt the previous user.
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/v1/auth/me").length).toBeGreaterThan(1));
    expect(useCartStore.getState().ownerId).toBeNull();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("drops the previous account when someone else logs in, without letting its stream write", async () => {
    useCartStore.setState({ items: [{ flavorId: "v", flavorName: "Vanilla", portions: 1, unitPriceMinor: 8500 }] });
    renderStream();
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const first = FakeEventSource.instances[0];
    act(() => first.emit("mine"));

    await userEvent.click(screen.getByRole("button", { name: "login-b" }));

    await waitFor(() => expect(useCartStore.getState().ownerId).toBe("user-b"));
    expect(useCartStore.getState().items).toEqual([]);
    expect(useNotificationStore.getState().notifications).toEqual([]);
    act(() => first.emit("late"));
    expect(useNotificationStore.getState().notifications).toEqual([]);
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(2));
    expect(first.closed).toBe(true);
  });

  it("keeps the owner's data when the session merely expires", async () => {
    useCartStore.setState({ items: [{ flavorId: "v", flavorName: "Vanilla", portions: 1, unitPriceMinor: 8500 }], ownerId: "user-a" });
    me = () => json({ code: "UNAUTHORIZED" }, 401);
    renderStream();
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(useCartStore.getState()).toMatchObject({ ownerId: "user-a" });
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
