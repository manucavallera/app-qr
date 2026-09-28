export type CounterPaymentMethod = "CASH" | "CARD_AT_COUNTER" | "BANK_TRANSFER" | "MERCADO_PAGO";

export function counterOrderConfirmationMessage(method: CounterPaymentMethod, status: string): string {
  if (method === "BANK_TRANSFER" && status === "AWAITING_PAYMENT") {
    return "Pedido creado. Confirmá la transferencia desde Pagos pendientes.";
  }
  if (method === "MERCADO_PAGO" && status === "AWAITING_PAYMENT") {
    return "Pedido creado. Mostrá el QR para pagar; quedará pendiente hasta la confirmación de Mercado Pago.";
  }
  return "Pedido creado y enviado a preparación.";
}
