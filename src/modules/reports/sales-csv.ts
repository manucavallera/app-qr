import type { SalesReport } from "./sales-report";

const pesos = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2).replace(".", ","));
const cell = (value: string | number) => {
  const text = String(value);
  // A leading =, +, - or @ would run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[;"\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Cash close as a spreadsheet file: semicolons and decimal commas, the way Excel in Spanish reads it. */
export function salesReportCsv(report: SalesReport, methodLabel: (method: string) => string): string {
  const rows: (string | number)[][] = [
    ["Cierre de caja", `${report.from} a ${report.to}`],
    [],
    ["Total vendido", pesos(report.totalCents)],
    ["Pedidos cobrados", report.orders],
    ["Costo", pesos(report.costCents)],
    ["Ganancia", pesos(report.profitCents)],
    ["Ventas sin costo cargado", pesos(report.uncostedCents)],
    ["Cancelados", report.cancelledOrders],
    ["Esperando pago", report.awaitingPaymentOrders],
    [],
    ["Medio de pago", "Cobros", "Total"],
    ...report.byPaymentMethod.map((row) => [methodLabel(row.method), row.payments, pesos(row.totalCents)]),
    [],
    ["Producto", "Unidades", "Total", "Costo", "Ganancia"],
    ...report.byProduct.map((row) => [row.productName, row.quantity, pesos(row.totalCents), pesos(row.costCents), pesos(row.profitCents)]),
  ];
  // The BOM makes Excel read accents as UTF-8.
  return `﻿${rows.map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
