import { DomainError } from "./errors";

export type OrderStatus =
  | "DRAFT"
  | "AWAITING_PAYMENT"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export type StaffRole = "ADMIN" | "OPERATOR";

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function assertOrderTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  role: StaffRole,
  reason?: string,
): void {
  if (currentStatus === "PREPARING" && targetStatus === "CANCELLED") {
    if (role !== "ADMIN") {
      throw new DomainError(
        "ADMIN_REQUIRED_TO_CANCEL_IN_PREPARATION",
        "Solo una persona administradora puede cancelar un pedido en preparación.",
      );
    }
    if (!reason?.trim()) {
      throw new DomainError(
        "CANCELLATION_REASON_REQUIRED",
        "La cancelación de un pedido en preparación requiere un motivo.",
      );
    }
  }

  if (!transitions[currentStatus].includes(targetStatus)) {
    throw new DomainError(
      "INVALID_ORDER_TRANSITION",
      `No se puede pasar un pedido de ${currentStatus} a ${targetStatus}.`,
      { currentStatus, targetStatus },
    );
  }
}
