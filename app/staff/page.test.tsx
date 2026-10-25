import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffPage from "@/app/staff/page";

const mutate = vi.fn();
const ticket = {
  id: "t1",
  pickup_slot_id: "s1",
  pickup_at: "2026-10-25T10:00:00Z",
  created_at: "2026-10-25T09:00:00Z",
  updated_at: "2026-10-25T09:00:00Z"
};

vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("@/lib/api", () => ({
  useFulfillments: () => ({
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    data: [
      { ...ticket, order_id: "o1", queue_number: "01", status: "PREPARING", items: [{ flavor_id: "p", flavor_name: "Pistachio", portions: 2 }] },
      { ...ticket, id: "t2", order_id: "o2", queue_number: "02", status: "READY_FOR_PICKUP", items: [{ flavor_id: "m", flavor_name: "Mango", portions: 1 }] }
    ]
  }),
  useUpdateFulfillmentStatus: () => ({ mutate, isPending: false, variables: undefined })
}));

describe("StaffPage", () => {
  it("separates tickets by status and sends the next valid status", async () => {
    render(<StaffPage />);
    expect(screen.getByText("#01")).toBeInTheDocument();
    expect(screen.getByText("#02")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "MARK READY" }));
    expect(mutate).toHaveBeenCalledWith(
      { orderId: "o1", status: "READY_FOR_PICKUP" },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    await userEvent.click(screen.getByRole("button", { name: "COMPLETE ORDER" }));
    expect(mutate).toHaveBeenLastCalledWith({ orderId: "o2", status: "PICKED_UP" }, expect.any(Object));
  });
});
