// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { addToCart, canPersistCart, cartTotal, clearCart, loadCart, removeCartItem, replaceCartItem, saveCart, type CartItem } from "./cart-store";

afterEach(() => localStorage.clear());

describe("QR cart storage", () => {
  it("does not persist a cart into a new QR before that QR cart has loaded", () => {
    expect(canPersistCart("mesa-uno", "mesa-uno")).toBe(true);
    expect(canPersistCart("mesa-uno", "mesa-dos")).toBe(false);
    expect(canPersistCart(null, "mesa-dos")).toBe(false);
  });

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

  it("can remove, replace, and clear selections without touching another QR cart", () => {
    const burger: CartItem = { productId: "burger", optionIds: ["cheddar"], notes: "", quantity: 1, displayedTotalCents: 5000 };
    const lemonade: CartItem = { productId: "lemonade", optionIds: [], notes: "sin hielo", quantity: 1, displayedTotalCents: 1800 };
    saveCart("mesa-uno", [burger, lemonade]);
    saveCart("mesa-dos", [burger]);

    expect(removeCartItem([burger, lemonade], 0)).toEqual([lemonade]);
    expect(replaceCartItem([burger, lemonade], 0, { ...burger, notes: "sin cebolla" })).toEqual([
      { ...burger, notes: "sin cebolla" },
      lemonade,
    ]);

    clearCart("mesa-uno");
    expect(loadCart("mesa-uno")).toEqual([]);
    expect(loadCart("mesa-dos")).toEqual([burger]);
  });
});
