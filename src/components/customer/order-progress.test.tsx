// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrderProgress } from "./order-progress";

afterEach(cleanup);

describe("OrderProgress", () => {
  it("shows the complete customer journey through delivery", () => {
    render(<OrderProgress currentStatus="CONFIRMED" />);

    expect(screen.getByRole("list", { name: "Estado del pedido" })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Pedido recibido")).toBeVisible();
    expect(screen.getByText("Entregado")).toBeVisible();
  });

  it("marks the current step and everything before it as complete", () => {
    render(<OrderProgress currentStatus="DELIVERED" />);

    expect(screen.getByText("Entregado").closest("li")).toHaveClass("is-current", "is-done");
    expect(screen.getByText("En preparación").closest("li")).toHaveClass("is-done");
  });
});
