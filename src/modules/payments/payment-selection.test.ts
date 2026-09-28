import { describe, expect, it } from "vitest";
import { selectCurrentPayment } from "./payment-selection";

describe("selectCurrentPayment", () => {
  it("prefers the approved attempt when legacy duplicate attempts exist", () => {
    expect(selectCurrentPayment([
      { method: "MERCADO_PAGO", status: "UNPAID" },
      { method: "MERCADO_PAGO", status: "APPROVED" },
    ])).toEqual({ method: "MERCADO_PAGO", status: "APPROVED" });
  });
});
