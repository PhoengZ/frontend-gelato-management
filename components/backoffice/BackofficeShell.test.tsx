import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackofficeShell } from "@/components/backoffice/BackofficeShell";
import { useNotificationStore } from "@/store/useNotificationStore";

vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/staff", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const staff = { id: "user-s", email: "s@example.com", display_name: "Staff", role: "STAFF", status: "ACTIVE", created_at: "2026-10-25T00:00:00Z" };
const lowStock = {
  id: "n1",
  type: "inventory.low_stock" as const,
  message: "Batch GF-01 is low on stock",
  occurred_at: "2026-11-07T10:00:00Z",
  data: { batch_id: "b", flavor_id: "f", flavor_name: "Pistachio", batch_code: "GF-01", remaining_portions: 4, threshold_portions: 5 },
  read: false
};

function renderShell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><BackofficeShell><p>page</p></BackofficeShell></QueryClientProvider>);
}

describe("BackofficeShell notifications", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(staff), { status: 200 }))));
    useNotificationStore.setState({ ownerId: "user-s", notifications: [lowStock], lastEventIds: {} });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows a bell with the unread count and Thai inventory alerts built from the data", async () => {
    renderShell();
    const [bell] = await screen.findAllByRole("button", { name: "แจ้งเตือนสต็อก (1 รายการใหม่)" });
    await userEvent.click(bell);
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("สต็อกใกล้หมด")).toBeInTheDocument();
    expect(within(panel).getByText("Pistachio (Batch GF-01) เหลือ 4 สกู๊ป ใกล้หมดแล้ว")).toBeInTheDocument();
    expect(within(panel).queryByText(/is low on stock/)).not.toBeInTheDocument();
    expect(within(panel).queryByText("ดูสถานะคำสั่งซื้อ")).not.toBeInTheDocument();
  });

  it("marks inventory alerts read", async () => {
    renderShell();
    const [bell] = await screen.findAllByRole("button", { name: /แจ้งเตือนสต็อก/ });
    await userEvent.click(bell);
    await userEvent.click(await screen.findByRole("button", { name: "อ่านทั้งหมด" }));
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });
});
