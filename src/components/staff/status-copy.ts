import { paymentMethodLabel, paymentStatusLabel } from "@/modules/payments/payment-methods";

export { paymentMethodLabel, paymentStatusLabel };

export const orderStatusLabel: Record<string, string> = {
  DRAFT: "Borrador",
  AWAITING_PAYMENT: "Esperando pago",
  CONFIRMED: "Confirmado",
  PREPARING: "En preparación",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const stationLabel: Record<string, string> = {
  GENERAL: "General",
  KITCHEN: "Cocina",
  BAR: "Barra",
};

export const fulfillmentLabel: Record<string, string> = {
  TABLE: "Entrega en mesa",
  PICKUP: "Retiro en barra",
};
