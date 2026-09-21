import type { OrderRepository } from "../orders/order-service";

export class TraditionalPaymentService {
  constructor(private readonly orders: OrderRepository) {}

  confirm(orderId: string, input: unknown, staffId: string) {
    return this.orders.confirmTraditionalPayment(orderId, input as Parameters<OrderRepository["confirmTraditionalPayment"]>[1], staffId);
  }
}
