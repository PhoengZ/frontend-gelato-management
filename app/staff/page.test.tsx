import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffPage from "@/app/staff/page";
import { formatTime } from "@/lib/utils";

const mutate = vi.fn();
const cancelMutate = vi.fn();
const replace = vi.fn();
const early = "2026-10-25T10:00:00Z";
const late = "2026-10-25T10:30:00Z";
const uuid = (n: number) => `${n}0000000-bd4d-48ca-9e4f-8d29d6cfbd4d`;
const ticket = (n: number, status: string, pickup_at: string, queue_number: string) => ({
  id: `t${n}`,
  order_id: uuid(n),
  queue_number,
  pickup_slot_id: pickup_at === early ? "s1" : "s2",
  pickup_at,
  status,
  items: [{ flavor_id: `f${n}`, flavor_name: `Flavor ${n}`, portions: 1 }],
  created_at: "2026-10-25T09:00:00Z",
  updated_at: "2026-10-25T09:00:00Z"
});

vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
const loaded = {
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  data: [
    ticket(1, "PREPARING", late, "04"),
    ticket(2, "QUEUED", early, "03"),
    ticket(3, "READY_FOR_PICKUP", early, "01"),
    ticket(4, "QUEUED", late, "05")
  ]
};
const useFulfillments = vi.fn();
const useFulfillmentLookup = vi.fn();
const failure = (status: number) => Object.assign(new Error("x"), { status });

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/api", () => ({
  useFulfillments: () => useFulfillments(),
  useFulfillmentLookup: (orderId: string | null) => useFulfillmentLookup(orderId),
  useUpdateFulfillmentStatus: () => ({ mutate, isPending: false, variables: undefined }),
  useStoreCancelOrder: () => ({ mutate: cancelMutate, isPending: false, variables: undefined })
}));

const slot = (pickupAt: string) => screen.getByRole("region", { name: `รอบรับ ${formatTime(pickupAt)} น.` });
const queueNumbers = (region: HTMLElement) => within(region).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
const ticketCard = (queueNumber: string) => screen.getByRole("article", { name: `คิว ${queueNumber}` });

describe("StaffPage", () => {
  beforeEach(() => {
    replace.mockReset();
    mutate.mockReset();
    cancelMutate.mockReset();
    useFulfillments.mockReturnValue(loaded);
    useFulfillmentLookup.mockReturnValue({ data: undefined, isFetching: false });
  });

  it("U09 keeps tickets on screen with a stale notice on a transient failure", () => {
    useFulfillments.mockReturnValue({ ...loaded, isError: true, error: failure(503) });
    render(<StaffPage />);
    expect(screen.getByText("#01")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ข้อมูลอาจไม่เป็นปัจจุบัน");
    expect(screen.queryByText("โหลดออเดอร์ไม่สำเร็จ")).not.toBeInTheDocument();
  });

  it("U09 redirects to login with next on 401", () => {
    window.history.replaceState(null, "", "/staff");
    useFulfillments.mockReturnValue({ ...loaded, isError: true, error: failure(401) });
    render(<StaffPage />);
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fstaff");
  });

  it("U09 does not blame the API Gateway when nothing has loaded", () => {
    useFulfillments.mockReturnValue({ ...loaded, data: undefined, isError: true, error: failure(503) });
    render(<StaffPage />);
    expect(screen.getByText("โหลดออเดอร์ไม่สำเร็จ")).toBeInTheDocument();
    expect(screen.queryByText(/API Gateway/)).not.toBeInTheDocument();
  });

  it("UC-02 groups tickets by pickup slot in time order, then by queue number", () => {
    render(<StaffPage />);
    const slots = screen.getAllByRole("region", { name: /^รอบรับ / });
    expect(slots.map((region) => region.getAttribute("aria-label"))).toEqual([`รอบรับ ${formatTime(early)} น.`, `รอบรับ ${formatTime(late)} น.`]);
    expect(queueNumbers(slot(early))).toEqual(["#01", "#03"]);
    expect(queueNumbers(slot(late))).toEqual(["#04", "#05"]);
  });

  it("UC-02 starts preparing a queued ticket", async () => {
    render(<StaffPage />);
    await userEvent.click(within(ticketCard("03")).getByRole("button", { name: "เริ่มเตรียม" }));
    expect(mutate).toHaveBeenCalledWith({ orderId: uuid(2), status: "PREPARING" }, expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
  });

  it("UC-02 moves a preparing ticket to ready and a ready ticket to picked up", async () => {
    render(<StaffPage />);
    expect(within(ticketCard("04")).queryByRole("button", { name: "ยกเลิก" })).not.toBeInTheDocument();
    await userEvent.click(within(ticketCard("04")).getByRole("button", { name: "พร้อมรับ" }));
    expect(mutate).toHaveBeenLastCalledWith({ orderId: uuid(1), status: "READY_FOR_PICKUP" }, expect.any(Object));
    await userEvent.click(within(ticketCard("01")).getByRole("button", { name: "ส่งมอบแล้ว" }));
    expect(mutate).toHaveBeenLastCalledWith({ orderId: uuid(3), status: "PICKED_UP" }, expect.any(Object));
  });

  it("UC-02 cancels a queued order for the store only after confirmation", async () => {
    render(<StaffPage />);
    await userEvent.click(within(ticketCard("03")).getByRole("button", { name: "ยกเลิก" }));
    expect(cancelMutate).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("#03");
    await userEvent.click(within(dialog).getByRole("button", { name: "ยืนยันยกเลิกออเดอร์" }));
    expect(cancelMutate).toHaveBeenCalledWith(uuid(2), expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
  });

  it("UC-02 keeps the order when the cancel confirmation is dismissed", async () => {
    render(<StaffPage />);
    await userEvent.click(within(ticketCard("05")).getByRole("button", { name: "ยกเลิก" }));
    await userEvent.click(await screen.findByRole("button", { name: "ไม่ยกเลิก" }));
    expect(cancelMutate).not.toHaveBeenCalled();
  });

  describe("search", () => {
    const search = () => screen.getByRole("searchbox", { name: "ค้นหาคิวหรือเลขออเดอร์" });

    it("filters by queue number, with or without # and leading zeros", async () => {
      render(<StaffPage />);
      await userEvent.type(search(), "#3");
      expect(screen.getByText("#03")).toBeInTheDocument();
      expect(screen.queryByText("#01")).not.toBeInTheDocument();
      expect(screen.queryByText("#04")).not.toBeInTheDocument();
    });

    it("filters by order id prefix", async () => {
      render(<StaffPage />);
      await userEvent.type(search(), uuid(4).slice(0, 8).toUpperCase());
      expect(screen.getByText("#05")).toBeInTheDocument();
      expect(screen.queryByText("#03")).not.toBeInTheDocument();
    });

    it("does not look up a ticket for a partial id", async () => {
      render(<StaffPage />);
      await userEvent.type(search(), "40000000");
      expect(useFulfillmentLookup).toHaveBeenLastCalledWith(null);
    });

    it("does not look up a full id that is already listed", async () => {
      render(<StaffPage />);
      await userEvent.type(search(), uuid(2));
      expect(useFulfillmentLookup).toHaveBeenLastCalledWith(null);
      expect(screen.getByText("#03")).toBeInTheDocument();
    });

    it("looks up a full order id that is not listed and shows a picked-up ticket without actions", async () => {
      const done = { ...ticket(9, "PICKED_UP", early, "09"), picked_up_at: "2026-10-25T10:05:00Z" };
      useFulfillmentLookup.mockImplementation((orderId: string | null) => ({ data: orderId === uuid(9) ? done : undefined, isFetching: false }));
      render(<StaffPage />);
      await userEvent.type(search(), uuid(9));
      expect(useFulfillmentLookup).toHaveBeenLastCalledWith(uuid(9));
      const card = ticketCard("09");
      expect(within(card).getByText("รับแล้ว")).toBeInTheDocument();
      expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    });

    it("says so when a looked-up order has no ticket", async () => {
      useFulfillmentLookup.mockReturnValue({ data: null, isFetching: false });
      render(<StaffPage />);
      await userEvent.type(search(), uuid(9));
      expect(screen.getByText("ไม่พบออเดอร์นี้")).toBeInTheDocument();
    });
  });
});
