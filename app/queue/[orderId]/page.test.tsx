import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueueTracker } from "@/components/QueueTracker";

const useQueueStatus = vi.fn();
vi.mock("@/lib/api", () => ({ useQueueStatus: (...args: unknown[]) => useQueueStatus(...args) }));

describe("QueueTracker", () => {
  it("renders a preparing queue and estimate", () => {
    useQueueStatus.mockReturnValue({ isLoading: false, isError: false, data: { orderId: "o1", queueNumber: "A-012", status: "PREPARING", createdAt: "2026-08-13T07:00:00.000Z", estimatedWaitMinutes: 7 } });
    render(<QueueTracker orderId="o1" />);
    expect(screen.getByLabelText("คิว A-012")).toBeInTheDocument();
    expect(screen.getByText("เชฟกำลังตั้งใจตัก Gelato สดใหม่สำหรับคุณ...")).toBeInTheDocument();
    expect(screen.getByText("7 MINS")).toBeInTheDocument();
  });

  it("shows the ready call to action", () => {
    useQueueStatus.mockReturnValue({ isLoading: false, isError: false, data: { orderId: "o1", queueNumber: "A-012", status: "READY", createdAt: "2026-08-13T07:00:00.000Z", estimatedWaitMinutes: 0 } });
    render(<QueueTracker orderId="o1" />);
    expect(screen.getByText("เจลาโต้ของคุณพร้อมแล้ว! แสดงหน้าจอนี้แก่พนักงานที่เคาน์เตอร์")).toBeInTheDocument();
    expect(screen.getByText("READY NOW")).toBeInTheDocument();
  });
});

