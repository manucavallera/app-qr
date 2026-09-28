import { describe, expect, it } from "vitest";
import { counterOrderConfirmationMessage } from "./counter-payment";

describe("counter payment messages", () => {
  it("does not say a counter transfer was sent to preparation before confirmation", () => {
    expect(counterOrderConfirmationMessage("BANK_TRANSFER", "AWAITING_PAYMENT")).toBe("Pedido creado. Confirmá la transferencia desde Pagos pendientes.");
    expect(counterOrderConfirmationMessage("MERCADO_PAGO", "AWAITING_PAYMENT")).toBe("Pedido creado. Mostrá el QR para pagar; quedará pendiente hasta la confirmación de Mercado Pago.");
    expect(counterOrderConfirmationMessage("CASH", "CONFIRMED")).toBe("Pedido creado y enviado a preparación.");
  });
});
