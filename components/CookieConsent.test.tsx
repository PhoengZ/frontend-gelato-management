import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookieConsent } from "@/components/CookieConsent";

describe("CookieConsent", () => {
  beforeEach(() => localStorage.clear());

  it("saves a consent choice and closes the dialog", async () => {
    render(<CookieConsent />);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "เฉพาะที่จำเป็น" }));

    expect(localStorage.getItem("gelatte-cookie-consent")).toBe("necessary");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("stays hidden when consent has already been saved", async () => {
    localStorage.setItem("gelatte-cookie-consent", "all");
    render(<CookieConsent />);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
