import { describe, expect, it } from "vitest";
import {
  availablePaymentMethods,
  paymentMethodLabel,
  paymentStatusLabel,
  type PaymentSettingsView,
} from "./payment-methods";

const settings: PaymentSettingsView = {
  mercadoPagoEnabled: true,
  cashEnabled: true,
  cardAtCounterEnabled: true,
  bankTransferEnabled: false,
  bankAlias: null,
  bankCbuCvu: null,
  bankAccountHolder: null,
  bankInstructions: null,
};

describe("payment method presentation", () => {
  it("uses clear Spanish labels for methods and statuses", () => {
    expect(paymentMethodLabel("MERCADO_PAGO")).toBe("Mercado Pago");
    expect(paymentMethodLabel("CASH")).toBe("Efectivo en caja");
    expect(paymentMethodLabel("CARD_AT_COUNTER")).toBe("Tarjeta en caja");
    expect(paymentMethodLabel("BANK_TRANSFER")).toBe("Transferencia bancaria");
    expect(paymentMethodLabel("OTHER")).toBe("Otro");
    expect(paymentStatusLabel("AWAITING_PAYMENT")).toBe("Esperando pago");
    expect(paymentStatusLabel("APPROVED")).toBe("Pago confirmado");
  });

  it("returns only enabled methods and configured Mercado Pago", () => {
    expect(availablePaymentMethods(settings, { mercadoPagoConfigured: true })).toEqual([
      "MERCADO_PAGO",
      "CASH",
      "CARD_AT_COUNTER",
    ]);
    expect(availablePaymentMethods(settings, { mercadoPagoConfigured: false })).toEqual([
      "CASH",
      "CARD_AT_COUNTER",
    ]);
  });

  it("hides transfer when enabled without bank instructions", () => {
    expect(
      availablePaymentMethods(
        { ...settings, bankTransferEnabled: true },
        { mercadoPagoConfigured: false },
      ),
    ).toEqual(["CASH", "CARD_AT_COUNTER"]);

    expect(
      availablePaymentMethods(
        { ...settings, bankTransferEnabled: true, bankAlias: "bar hamburguesas" },
        { mercadoPagoConfigured: false },
      ),
    ).toEqual(["CASH", "CARD_AT_COUNTER", "BANK_TRANSFER"]);
  });
});
