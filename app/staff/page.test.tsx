import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffPage from "@/app/staff/page";

const mutate = vi.fn();
const replace = vi.fn();
const ticket = {
  id: "t1",
  pickup_slot_id: "s1",
  pickup_at: "2026-10-25T10:00:00Z",
  created_at: "2026-10-25T09:00:00Z",
  updated_at: "2026-10-25T09:00:00Z"
};

vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
const loaded = {
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  data: [
    { ...ticket, order_id: "o1", queue_number: "01", status: "PREPARING", items: [{ flavor_id: "p", flavor_name: "Pistachio", portions: 2 }] },
    { ...ticket, id: "t2", order_id: "o2", queue_number: "02", status: "READY_FOR_PICKUP", items: [{ flavor_id: "m", flavor_name: "Mango", portions: 1 }] }
  ]
};
const useFulfillments = vi.fn();
const failure = (status: number) => Object.assign(new Error("x"), { status });

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/api", () => ({
  useFulfillments: () => useFulfillments(),
  useUpdateFulfillmentStatus: () => ({ mutate, isPending: false, variables: undefined })
}));

describe("StaffPage", () => {
  beforeEach(() => {
    replace.mockReset();
    useFulfillments.mockReturnValue(loaded);
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

  it("separates tickets by status and sends the next valid status", async () => {
    render(<StaffPage />);
    expect(screen.getByText("#01")).toBeInTheDocument();
    expect(screen.getByText("#02")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "พร้อมเสิร์ฟ" }));
    expect(mutate).toHaveBeenCalledWith(
      { orderId: "o1", status: "READY_FOR_PICKUP" },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    await userEvent.click(screen.getByRole("button", { name: "ส่งมอบแล้ว" }));
    expect(mutate).toHaveBeenLastCalledWith({ orderId: "o2", status: "PICKED_UP" }, expect.any(Object));
  });
});
