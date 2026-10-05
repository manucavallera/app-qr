export type SupplyUnitValue = "UNIT" | "GRAM" | "MILLILITER";

export const supplyUnitLabel: Record<SupplyUnitValue, string> = { UNIT: "Unidades", GRAM: "Gramos (kg)", MILLILITER: "Mililitros (litros)" };

/** Shows a base-unit quantity the way a person says it: 2500 g reads "2,5 kg". */
export function formatSupplyQuantity(quantity: number, unit: SupplyUnitValue): string {
  const number = (value: number) => value.toLocaleString("es-AR", { maximumFractionDigits: 3 });
  if (unit === "UNIT") return `${number(quantity)} u`;
  if (quantity >= 1000) return `${number(quantity / 1000)} ${unit === "GRAM" ? "kg" : "L"}`;
  return `${number(quantity)} ${unit === "GRAM" ? "g" : "ml"}`;
}

/** Turns what the person typed ("2,5") into the base unit; `large` means kg or liters. Null when not a valid amount. */
export function parseSupplyQuantity(text: string, large: boolean): number | null {
  const value = Number(text.trim().replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  const base = Math.round(large ? value * 1000 : value);
  return base <= 100_000_000 ? base : null;
}
