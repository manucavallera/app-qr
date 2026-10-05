import { describe, expect, it } from "vitest";
import { salesReportCsv } from "@/modules/reports/sales-csv";

const report = {
  from: "2026-10-05", to: "2026-10-05", timezone: "America/Argentina/Buenos_Aires",
  totalCents: 1234550, orders: 3, cancelledOrders: 1, awaitingPaymentOrders: 0, onTabOrders: 0, onTabCents: 0,
  costCents: 400000, profitCents: 600000, uncostedCents: 234550,
  byPaymentMethod: [{ method: "CASH", totalCents: 1234550, payments: 3 }],
  byProduct: [
    { productName: 'Pizza "grande"; muzza', quantity: 2, totalCents: 1000000, costCents: 400000, profitCents: 600000 },
    { productName: "=HYPERLINK(1)", quantity: 1, totalCents: 234550, costCents: null, profitCents: null },
  ],
};

describe("sales report CSV", () => {
  const csv = salesReportCsv(report, () => "Efectivo");

  it("uses semicolons, decimal commas and a BOM so Excel in Spanish opens it right", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Total vendido;12345,50\r\n");
    expect(csv).toContain("Ganancia;6000,00\r\n");
    expect(csv).toContain("Efectivo;3;12345,50\r\n");
  });

  it("quotes text with separators and defuses spreadsheet formulas", () => {
    expect(csv).toContain('"Pizza ""grande""; muzza";2;10000,00;4000,00;6000,00\r\n');
    expect(csv).toContain("'=HYPERLINK(1);1;2345,50;;\r\n");
  });
});
