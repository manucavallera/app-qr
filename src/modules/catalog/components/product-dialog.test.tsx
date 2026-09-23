// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductDialog, type MenuProduct } from "./product-dialog";

const product: MenuProduct = {
  id: "burger",
  name: "Hamburguesa",
  description: "Con papas",
  priceCents: 5000,
  available: true,
  optionGroups: [
    {
      id: "cooking",
      name: "Punto",
      required: true,
      minSelections: 1,
      maxSelections: 1,
      values: [{ id: "well", name: "Bien cocida", priceDeltaCents: 0 }],
    },
  ],
};

describe("ProductDialog", () => {
  it("requires mandatory options, then adds the chosen product and quantity", () => {
    const onAdd = vi.fn();
    render(<ProductDialog product={product} onAdd={onAdd} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /agregar al carrito/i }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/elegí/i);

    fireEvent.click(screen.getByLabelText("Bien cocida"));
    fireEvent.change(screen.getByPlaceholderText("Ej. sin hielo"), { target: { value: "sin sal" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar al carrito/i }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ productId: "burger", optionIds: ["well"], notes: "sin sal", quantity: 1 }));
  });
});
