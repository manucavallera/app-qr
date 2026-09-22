export type PaymentMethodValue =
  | "MERCADO_PAGO"
  | "CASH"
  | "CARD_AT_COUNTER"
  | "BANK_TRANSFER"
  | "OTHER";

export type PublicPaymentMethod = Exclude<PaymentMethodValue, "OTHER">;

export type PaymentSettingsView = {
  mercadoPagoEnabled: boolean;
  cashEnabled: boolean;
  cardAtCounterEnabled: boolean;
  bankTransferEnabled: boolean;
  bankAlias: string | null;
  bankCbuCvu: string | null;
  bankAccountHolder: string | null;
  bankInstructions: string | null;
};

export type PaymentAvailability = {
  mercadoPagoConfigured: boolean;
};

const methodLabels: Record<PaymentMethodValue, string> = {
  MERCADO_PAGO: "Mercado Pago",
  CASH: "Efectivo en caja",
  CARD_AT_COUNTER: "Tarjeta en caja",
  BANK_TRANSFER: "Transferencia bancaria",
  OTHER: "Otro",
};

const statusLabels: Record<string, string> = {
  UNPAID: "Sin pagar",
  PENDING: "Pago pendiente",
  APPROVED: "Pago confirmado",
  REJECTED: "Pago rechazado",
  REFUNDED: "Reembolsado",
  PARTIALLY_REFUNDED: "Reembolso parcial",
  AWAITING_PAYMENT: "Esperando pago",
  CONFIRMED: "Pedido confirmado",
  PREPARING: "En preparación",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function paymentMethodLabel(method: PaymentMethodValue): string {
  return methodLabels[method];
}

export function paymentStatusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

function hasBankInstructions(settings: PaymentSettingsView): boolean {
  return Boolean(settings.bankAlias?.trim() || settings.bankCbuCvu?.trim());
}

export function availablePaymentMethods(
  settings: PaymentSettingsView,
  availability: PaymentAvailability,
): PublicPaymentMethod[] {
  const methods: PublicPaymentMethod[] = [];
  if (settings.mercadoPagoEnabled && availability.mercadoPagoConfigured) methods.push("MERCADO_PAGO");
  if (settings.cashEnabled) methods.push("CASH");
  if (settings.cardAtCounterEnabled) methods.push("CARD_AT_COUNTER");
  if (settings.bankTransferEnabled && hasBankInstructions(settings)) methods.push("BANK_TRANSFER");
  return methods;
}
