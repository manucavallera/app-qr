// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CustomerShell } from "./customer-shell";

afterEach(cleanup);

describe("CustomerShell", () => {
  it("renders the customer title, content, and a semantic back link", () => {
    render(
      <CustomerShell eyebrow="Paso 2 de 4" title="Confirmá tu pedido" backHref="/m/token">
        <p>Contenido</p>
      </CustomerShell>,
    );

    expect(screen.getByRole("heading", { name: "Confirmá tu pedido" })).toBeVisible();
    expect(screen.getByText("Contenido")).toBeVisible();
    expect(screen.getByRole("link", { name: "Volver a la carta" })).toHaveAttribute("href", "/m/token");
  });
});
