import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AnalyticsPage from "@/app/analytics/page";

const useAnalytics = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/api", () => ({ useAnalytics: (...args: unknown[]) => useAnalytics(...args) }));

const data = {
  totalRevenue: 1000,
  totalOrders: 2,
  totalScoops: 4,
  totalWaste: 1,
  salesByFlavor: [],
  wasteByFlavor: [],
  salesTrend: [{ date: "2026-11-01", label: "1 พ.ย.", revenue: 100, orders: 1, scoops: 1 }, { date: "2026-11-02", label: "2 พ.ย.", revenue: 900, orders: 1, scoops: 3 }]
};
const loaded = { isLoading: false, isError: false, isFetching: false, refetch: vi.fn(), data };
const failure = (status: number) => Object.assign(new Error("x"), { status });

describe("AnalyticsPage", () => {
  beforeEach(() => {
    replace.mockReset();
    useAnalytics.mockReturnValue(loaded);
  });

  it("F06 keeps every top-level grid from growing past a phone viewport", () => {
    const { container } = render(<AnalyticsPage />);
    const grids = container.querySelectorAll("main > section.grid");
    expect(grids.length).toBe(3);
    grids.forEach((grid) => {
      expect(grid.className).toContain("grid-cols-[minmax(0,1fr)]");
      expect(grid.className).toContain("[&>*]:min-w-0");
    });
  });

  it("F06 lets only the chart scroll horizontally", () => {
    render(<AnalyticsPage />);
    const chart = screen.getByRole("img", { name: "กราฟรายได้ย้อนหลัง" });
    expect(chart.className).toContain("overflow-x-auto");
    expect(chart.querySelector("svg")?.getAttribute("class")).toContain("min-w-[560px]");
  });

  it("U09 keeps loaded data with a stale notice on a transient failure", () => {
    useAnalytics.mockReturnValue({ ...loaded, isError: true, error: failure(503) });
    render(<AnalyticsPage />);
    expect(screen.getByText("ยอดขายรวม")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ข้อมูลอาจไม่เป็นปัจจุบัน");
    expect(screen.queryByText("โหลดรายงานไม่สำเร็จ")).not.toBeInTheDocument();
  });

  it("U09 redirects to login with next on 401", () => {
    window.history.replaceState(null, "", "/analytics");
    useAnalytics.mockReturnValue({ ...loaded, isError: true, error: failure(401) });
    render(<AnalyticsPage />);
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fanalytics");
  });

  it("U09 still shows the error card when nothing has loaded", () => {
    useAnalytics.mockReturnValue({ ...loaded, data: undefined, isError: true, error: failure(503) });
    render(<AnalyticsPage />);
    expect(screen.getByText("โหลดรายงานไม่สำเร็จ")).toBeInTheDocument();
  });
});
