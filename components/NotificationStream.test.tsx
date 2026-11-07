import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "sonner";
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
  emit(id: string, type = "order.ready", data: Record<string, unknown> = { order_id: "order-a" }) {
    const frame = JSON.stringify({ id, type, message: "server text", occurred_at: "2026-11-07T10:00:00Z", data });
    this.listeners.get(type)?.({ data: frame, lastEventId: id } as MessageEvent<string>);
  }
  fail() {
    this.readyState = FakeEventSource.CLOSED;
    this.onerror?.();
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
    useNotificationStore.setState({ notifications: [], ownerId: null, lastEventIds: {} });
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

  it("shows Thai copy in the toast instead of the server's English text", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><Toaster /><NotificationStream /></QueryClientProvider>);
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    act(() => FakeEventSource.instances[0].emit("e1"));
    expect(await screen.findByText("เจลาโตของคุณพร้อมแล้ว มารับที่เคาน์เตอร์ได้เลย")).toBeInTheDocument();
    expect(screen.queryByText("server text")).not.toBeInTheDocument();
  });

  it("shows Thai copy and the queue number once in the notification panel", async () => {
    useNotificationStore.setState({
      ownerId: "user-a",
      notifications: [{ id: "n1", type: "order.ready", message: "Your gelato order is ready for pickup!", occurred_at: "2026-11-07T10:00:00Z", data: { order_id: "order-a", queue_number: "03" }, read: false }]
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CustomerNotification /></QueryClientProvider>);
    await userEvent.click(await screen.findByRole("button", { name: /แจ้งเตือนสถานะคิว/ }));
    expect(await screen.findByText("คิว #03 พร้อมแล้ว มารับที่เคาน์เตอร์ได้เลย")).toBeInTheDocument();
    expect(screen.queryByText(/Your gelato order/)).not.toBeInTheDocument();
  });

  it.each(["STAFF", "MANAGER"])("opens a stream of inventory alerts for %s", async (role) => {
    me = () => json({ ...userA, role });
    renderStream();
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0];
    expect(Array.from(source.listeners.keys()).sort()).toEqual(["inventory.expiring", "inventory.low_stock"]);
    act(() => source.emit("inv-1", "inventory.low_stock", { batch_id: "b", flavor_id: "f", flavor_name: "Pistachio", remaining_portions: 4 }));
    expect(useNotificationStore.getState().notifications.map((item) => item.id)).toEqual(["inv-1"]);
  });

  it("listens only to order notifications for a customer", async () => {
    renderStream();
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    expect(Array.from(FakeEventSource.instances[0].listeners.keys()).sort()).toEqual(["order.cancelled", "order.confirmed", "order.ready"]);
  });

  describe("replay", () => {
    afterEach(() => vi.useRealTimers());

    it("resumes from the owner's last received notification id", async () => {
      useNotificationStore.setState({ lastEventIds: { "user-a": "e7", "user-b": "other" } });
      renderStream();
      await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
      expect(FakeEventSource.instances[0].url).toBe("/api/v1/notifications/stream?last_event_id=e7");
    });

    it("ignores another owner's last id and asks for the whole buffer", async () => {
      useNotificationStore.setState({ lastEventIds: { "user-b": "other" } });
      renderStream();
      await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
      expect(FakeEventSource.instances[0].url).toBe("/api/v1/notifications/stream");
    });

    it("passes the last received id when reconnecting a closed stream", async () => {
      renderStream();
      await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      act(() => FakeEventSource.instances[0].emit("e1"));
      act(() => FakeEventSource.instances[0].emit("e2"));
      act(() => FakeEventSource.instances[0].fail());
      act(() => { vi.advanceTimersByTime(15_000); });
      expect(FakeEventSource.instances).toHaveLength(2);
      expect(FakeEventSource.instances[1].url).toBe("/api/v1/notifications/stream?last_event_id=e2");
    });

    it("keeps the panel and toasts free of duplicates when notifications are replayed", async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(<QueryClientProvider client={client}><Toaster /><NotificationStream /></QueryClientProvider>);
      await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
      // A queue number no other test uses, because sonner keeps toasts across tests.
      const replayed = () => FakeEventSource.instances[0].emit("e1", "order.ready", { order_id: "order-a", queue_number: "42" });
      act(replayed);
      act(replayed);
      act(replayed);
      expect(useNotificationStore.getState().notifications).toHaveLength(1);
      expect(await screen.findAllByText("คิว #42 พร้อมแล้ว มารับที่เคาน์เตอร์ได้เลย")).toHaveLength(1);
    });

    it("remembers the last id across logout so the same user is not replayed old alerts", async () => {
      renderStream();
      await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
      act(() => FakeEventSource.instances[0].emit("e1"));
      await userEvent.click(screen.getByRole("button", { name: "logout" }));
      await waitFor(() => expect(FakeEventSource.instances[0].closed).toBe(true));
      expect(useNotificationStore.getState().lastEventIds).toEqual({ "user-a": "e1" });
    });
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
