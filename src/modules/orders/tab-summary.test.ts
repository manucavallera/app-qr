import { describe, expect, it } from "vitest";
import { settleTabInputSchema, summarizeTab, type TabOrder } from "./tab-summary";

function order(number: number, sessionId: string | null, name: string, totalCents: number): TabOrder {
  return { number, customerSessionId: sessionId, personName: name, totalCents, items: [] };
}

describe("summarizeTab", () => {
  it("groups unpaid orders by person and totals the table", () => {
    const summary = summarizeTab([order(1, "a", "Ana", 1000), order(2, "b", "Beto", 500), order(3, "a", "Ana", 250)]);
    expect(summary.totalCents).toBe(1750);
    expect(summary.people.map((person) => [person.name, person.totalCents, person.orders.length])).toEqual([["Ana", 1250, 2], ["Beto", 500, 1]]);
  });

  it("groups orders without a session by name", () => {
    const summary = summarizeTab([order(1, null, "Caja", 100), order(2, null, "Caja", 100)]);
    expect(summary.people).toHaveLength(1);
    expect(summary.people[0]?.totalCents).toBe(200);
  });

  it("is empty for a table with nothing open", () => {
    expect(summarizeTab([])).toEqual({ totalCents: 0, people: [] });
  });
});

describe("settleTabInputSchema", () => {
  const tabId = "8d2c4c4e-6f2b-4d5e-9b8a-0a1b2c3d4e5f";
  it("accepts a whole table or one person with a manual method", () => {
    expect(settleTabInputSchema.safeParse({ tabId, method: "CASH" }).success).toBe(true);
    expect(settleTabInputSchema.safeParse({ tabId, method: "BANK_TRANSFER", personKey: "name:Caja" }).success).toBe(true);
  });
  it("rejects online or unknown methods", () => {
    expect(settleTabInputSchema.safeParse({ tabId, method: "MERCADO_PAGO" }).success).toBe(false);
    expect(settleTabInputSchema.safeParse({ tabId, method: "ON_TAB" }).success).toBe(false);
  });
});
