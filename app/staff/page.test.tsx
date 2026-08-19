import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffPage from "@/app/staff/page";

const mutate = vi.fn();
vi.mock("@/lib/api", () => ({
  useFulfillments: () => ({
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    data: [
      { orderId: "o1", queueNumber: "A-001", status: "PREPARING", createdAt: "2026-08-13T07:00:00.000Z", estimatedWaitMinutes: 5, items: [{ flavorId: "p", flavorName: "Pistachio", portions: 2 }] },
      { orderId: "o2", queueNumber: "A-002", status: "READY", createdAt: "2026-08-13T07:01:00.000Z", estimatedWaitMinutes: 0, items: [{ flavorId: "m", flavorName: "Mango", portions: 1 }] }
    ]
  }),
  useUpdateOrderStatus: () => ({ mutate, variables: undefined })
}));

describe("StaffPage", () => {
  it("separates active orders and sends the next valid status", async () => {
    render(<StaffPage />);
    expect(screen.getByText("#A-001")).toBeInTheDocument();
    expect(screen.getByText("#A-002")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "MARK READY" }));
    expect(mutate).toHaveBeenCalledWith(
      { orderId: "o1", status: "READY" },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
  });
});

