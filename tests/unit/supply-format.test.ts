import { describe, expect, it } from "vitest";
import { formatSupplyQuantity, parseSupplyQuantity } from "@/modules/supplies/supply-format";

describe("supply quantities", () => {
  it("shows grams and milliliters in kg and L from 1000 up", () => {
    expect(formatSupplyQuantity(500, "GRAM")).toBe("500 g");
    expect(formatSupplyQuantity(2500, "GRAM")).toBe("2,5 kg");
    expect(formatSupplyQuantity(1000, "MILLILITER")).toBe("1 L");
    expect(formatSupplyQuantity(12, "UNIT")).toBe("12 u");
  });

  it("reads comma or dot decimals and converts kg and L to the base unit", () => {
    expect(parseSupplyQuantity("2,5", true)).toBe(2500);
    expect(parseSupplyQuantity("2.5", true)).toBe(2500);
    expect(parseSupplyQuantity("150", false)).toBe(150);
    expect(parseSupplyQuantity("-1", false)).toBeNull();
    expect(parseSupplyQuantity("abc", false)).toBeNull();
    expect(parseSupplyQuantity("999999", true)).toBeNull();
  });
});
