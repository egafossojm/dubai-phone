/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MobileNav } from "@/components/layout/mobile-nav";

describe("MobileNav", () => {
  it("ouvre le menu et affiche les liens", () => {
    render(
      <MobileNav
        userName="Paul Stock"
        items={[
          { href: "/stock", label: "Stock" },
          { href: "/achats", label: "Achats" },
        ]}
      />,
    );

    expect(screen.queryByRole("navigation", { name: "Navigation mobile" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }));
    expect(screen.getByRole("navigation", { name: "Navigation mobile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stock" })).toHaveAttribute("href", "/stock");
    expect(screen.getByText("Paul Stock")).toBeInTheDocument();
  });
});
