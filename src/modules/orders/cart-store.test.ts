// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { addToCart, cartTotal, loadCart, saveCart, type CartItem } from "./cart-store";

afterEach(() => localStorage.clear());

describe("QR cart storage", () => {
  it("keeps independent cart data per QR token and only stores order selections", () => {
    const mesaUno: CartItem[] = [
      { productId: "burger", optionIds: ["cheddar"], notes: "sin cebolla", quantity: 2, displayedTotalCents: 12500 },
    ];
    saveCart("mesa-uno", mesaUno);
    saveCart("mesa-dos", [{ productId: "limonada", optionIds: [], notes: "", quantity: 1, displayedTotalCents: 1800 }]);

    expect(loadCart("mesa-uno")).toEqual(mesaUno);
    expect(loadCart("mesa-dos")).toHaveLength(1);
    expect(localStorage.getItem("app-qr-cart:mesa-uno")).not.toContain("nickname");
  });

  it("combines identical selections, validates stored values, and totals displayed amounts", () => {
    const first: CartItem = { productId: "burger", optionIds: ["cheddar"], notes: "", quantity: 1, displayedTotalCents: 5000 };
    const combined = addToCart([first], { ...first, quantity: 2 });

    expect(combined).toHaveLength(1);
    expect(combined[0]?.quantity).toBe(3);
    expect(cartTotal(combined)).toBe(15000);
    localStorage.setItem("app-qr-cart:bad", JSON.stringify([{ productId: "burger", quantity: -3 }]));
    expect(loadCart("bad")).toEqual([]);
  });
});
