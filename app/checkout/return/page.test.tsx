import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import CheckoutReturnPage from "@/app/checkout/return/page";
import { useCartStore } from "@/store/useCartStore";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const checkout = { idempotencyKey: "k", order: { pickup_at: "2026-11-07T10:00:00.000Z", items: [] }, orderId: "o1" };

describe("CheckoutReturnPage", () => {
  beforeEach(() => {
    replace.mockReset();
    useCartStore.setState({ items: [], checkout, ownerId: "u", activeOrderId: "o1" });
  });

  it("passes a timestamp marker after a Stripe success return", () => {
    window.history.replaceState(null, "", "/checkout/return?session_id=cs_test");
    render(<CheckoutReturnPage />);
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/queue\/o1\?returned_at=\d+$/));
  });

  it("passes no marker when the payment was cancelled", () => {
    window.history.replaceState(null, "", "/checkout/return?cancelled=1");
    render(<CheckoutReturnPage />);
    expect(replace).toHaveBeenCalledWith("/queue/o1");
  });

  it("falls back to the active order once the checkout has been cleared", () => {
    useCartStore.setState({ checkout: null });
    window.history.replaceState(null, "", "/checkout/return?session_id=cs_test");
    render(<CheckoutReturnPage />);
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/queue\/o1\?/));
  });
});
