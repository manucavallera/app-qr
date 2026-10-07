// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TabReceipt, type ReceiptTab } from "@/components/receipt/tab-receipt";

afterEach(cleanup);

const beto = { key: "s1", name: "Beto", totalCents: 380000, orders: [{ number: 7, items: [{ productName: "Cerveza tirada", quantity: 1, lineTotalCents: 380000 }] }] };
const caro = { key: "s2", name: "Caro", totalCents: 560000, orders: [{ number: 8, items: [{ productName: "Gaseosa", quantity: 2, lineTotalCents: 560000 }] }] };
const base = { number: 2, label: "Mesa 4", openedAt: "2026-10-07T01:00:00.000Z" };

describe("TabReceipt", () => {
  it("lists what each person owes, their subtotal and the table total", () => {
    const tab: ReceiptTab = { ...base, totalCents: 940000, people: [beto, caro] };
    render(<TabReceipt tab={tab} businessName="Bar de prueba" />);

    const receipt = screen.getByRole("article", { name: "Cuenta de Mesa 4" });
    expect(within(receipt).getByText("Bar de prueba")).toBeInTheDocument();
    expect(within(receipt).getByText("#2")).toBeInTheDocument();
    const betoSection = within(receipt).getByRole("region", { name: "Beto" });
    expect(within(betoSection).getByText("1 × Cerveza tirada")).toBeInTheDocument();
    expect(within(betoSection).getByText("Subtotal Beto")).toBeInTheDocument();
    expect(within(within(receipt).getByRole("region", { name: "Caro" })).getByText("2 × Gaseosa")).toBeInTheDocument();
    expect(within(receipt).getByText("Total").nextElementSibling).toHaveTextContent("9.400");
    expect(within(receipt).getByText("Documento no válido como factura.")).toBeInTheDocument();
  });

  it("skips names and subtotals when one person carries the whole table", () => {
    render(<TabReceipt tab={{ ...base, totalCents: 380000, people: [beto] }} businessName="Bar de prueba" />);

    expect(screen.queryByRole("heading", { name: "Beto" })).not.toBeInTheDocument();
    expect(screen.queryByText("Subtotal Beto")).not.toBeInTheDocument();
    expect(screen.getByText("1 × Cerveza tirada")).toBeInTheDocument();
  });
});
