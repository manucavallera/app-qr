// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductCard } from "./product-card";

afterEach(cleanup);

const product = {
  id: "burger",
  name: "Hamburguesa",
  description: "Doble carne y queso",
  priceCents: 1500000,
  available: true,
  optionGroups: [],
};

describe("ProductCard", () => {
  it("lets the customer select an available product", () => {
    const onSelect = vi.fn();
    render(<ProductCard product={product} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar Hamburguesa" }));

    expect(onSelect).toHaveBeenCalledWith(product);
  });

  it("exposes an unavailable product without selecting it", () => {
    const onSelect = vi.fn();
    render(<ProductCard product={{ ...product, available: false }} onSelect={onSelect} />);

    const button = screen.getByRole("button", { name: "Hamburguesa, agotado" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
