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

export const orderOriginLabel: Record<string, string> = {
  QR: "QR",
  COUNTER: "Caja",
};

export const staffRoleLabel: Record<string, string> = {
  ADMIN: "Administrador",
  OPERATOR: "Operador",
};

export const auditActionLabel: Record<string, string> = {
  STAFF_USER_CREATED: "Usuario creado",
  STAFF_USER_UPDATED: "Usuario actualizado",
  STAFF_USER_DEACTIVATED: "Usuario desactivado",
  STAFF_USER_ACTIVATED: "Usuario activado",
  SETTINGS_UPDATED: "Configuración actualizada",
  ORDER_COUNTER_CREATED: "Pedido creado en caja",
  ORDER_STATUS_CHANGED: "Estado de pedido actualizado",
  ORDER_EXPIRED_UNPAID: "Pedido cancelado por falta de pago",
  PAYMENT_APPROVED_AFTER_CANCELLATION: "Pago aprobado sobre pedido cancelado",
  PAYMENT_TRADITIONAL_CONFIRMED: "Pago manual confirmado",
  PAYMENT_TRADITIONAL_REJECTED: "Pago manual rechazado",
  PAYMENT_RECONCILED: "Pago conciliado",
  CUSTOMER_SESSION_CLOSED: "Sesión de cliente cerrada",
  PRODUCT_CREATED: "Producto creado",
  PRODUCT_UPDATED: "Producto actualizado",
  PRODUCT_ARCHIVED: "Producto archivado",
  PRODUCT_AVAILABILITY_CHANGED: "Disponibilidad de producto actualizada",
  CATEGORY_CREATED: "Categoría creada",
  CATEGORY_REORDERED: "Categorías reordenadas",
  SUPPLY_CREATED: "Insumo creado",
  SUPPLY_UPDATED: "Insumo actualizado",
  SUPPLY_STOCK_CHANGED: "Stock de insumo modificado",
};

export const auditEntityLabel: Record<string, string> = {
  StaffUser: "Usuario del equipo",
  BusinessSettings: "Configuración del local",
  PaymentAttempt: "Intento de pago",
  Order: "Pedido",
  CustomerSession: "Sesión de cliente",
  Product: "Producto",
  Category: "Categoría",
  Supply: "Insumo",
};

export function humanizeStaffCode(value: string | null | undefined): string {
  if (!value) return "Sin datos";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const stationLabel: Record<string, string> = {
  GENERAL: "General",
  KITCHEN: "Cocina",
  BAR: "Barra",
};

export const fulfillmentLabel: Record<string, string> = {
  TABLE: "Entrega en mesa",
  PICKUP: "Retiro en barra",
};
