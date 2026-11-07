import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ManagerPage from "@/app/manager/page";

const useInventory = vi.fn();
const replace = vi.fn();
const idle = () => ({ mutate: vi.fn(), isPending: false });
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/api", () => ({
  useInventory: () => useInventory(),
  useArchiveFlavor: () => idle(),
  useCreateBatch: () => idle(),
  useCreateFlavor: () => idle(),
  useRecordWaste: () => idle(),
  useUpdateFlavor: () => idle()
}));

const loaded = { isLoading: false, isError: false, refetch: vi.fn(), data: { flavors: [], batches: [] } };
const failure = (status: number) => Object.assign(new Error("x"), { status });

describe("ManagerPage", () => {
  beforeEach(() => replace.mockReset());

  it("U09 keeps loaded data with a stale notice on a transient failure", () => {
    useInventory.mockReturnValue({ ...loaded, isError: true, error: failure(502) });
    render(<ManagerPage />);
    expect(screen.getByText("เมนูและคลังสินค้า")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ข้อมูลอาจไม่เป็นปัจจุบัน");
  });

  it("U09 redirects to login with next on 401", () => {
    window.history.replaceState(null, "", "/manager");
    useInventory.mockReturnValue({ ...loaded, isError: true, error: failure(401) });
    render(<ManagerPage />);
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fmanager");
  });

  it("U09 still shows the error card when nothing has loaded", () => {
    useInventory.mockReturnValue({ ...loaded, data: undefined, isError: true, error: failure(503) });
    render(<ManagerPage />);
    expect(screen.getByText("โหลดคลังสินค้าไม่สำเร็จ")).toBeInTheDocument();
  });
});
