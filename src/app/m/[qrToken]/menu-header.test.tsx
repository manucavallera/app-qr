// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MenuHeader } from "./menu-header";

afterEach(cleanup);

describe("MenuHeader", () => {
  it("shows only configured public details", () => {
    render(
      <MenuHeader
        business={{
          name: "Bar Norte",
          locationUrl: null,
          instagramUrl: "https://instagram.com/bar",
          whatsappUrl: null,
        }}
        hoursLabel={null}
      />,
    );

    expect(screen.getByText("Bar Norte")).toBeVisible();
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/bar");
    expect(screen.queryByRole("link", { name: "Cómo llegar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
    expect(screen.queryByText(/hs a/i)).not.toBeInTheDocument();
  });

  it("shows configured contact links and service hours", () => {
    render(
      <MenuHeader
        business={{
          name: "Bar Norte",
          locationUrl: "https://maps.example.com",
          instagramUrl: null,
          whatsappUrl: "https://wa.me/5491100000000",
        }}
        hoursLabel="18:00hs a 01:00hs"
      />,
    );

    expect(screen.getByRole("link", { name: "Cómo llegar" })).toHaveAttribute("href", "https://maps.example.com");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/5491100000000");
    expect(screen.getByText("18:00hs a 01:00hs")).toBeVisible();
  });
});
