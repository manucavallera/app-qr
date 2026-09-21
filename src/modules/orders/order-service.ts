import type { CreateCounterOrderInput, CreateQrOrderInput, ConfirmTraditionalPaymentInput } from "./order-contracts";
import {
  confirmTraditionalPaymentInputSchema,
  createCounterOrderInputSchema,
  createQrOrderInputSchema,
} from "./order-contracts";

export type OrderRepository = {
  createQrOrder(input: CreateQrOrderInput, sessionToken: string, clientIp: string): Promise<{ order: unknown; created: boolean }>;
  createCounterOrder(input: CreateCounterOrderInput, staffId: string): Promise<{ order: unknown; created: boolean }>;
  confirmTraditionalPayment(orderId: string, input: ConfirmTraditionalPaymentInput, staffId: string): Promise<unknown>;
  findCustomerOrder(orderId: string, customerSessionId: string): Promise<unknown | null>;
  listPendingTraditionalPayments(): Promise<unknown[]>;
  listStaffOrders(): Promise<unknown[]>;
};

export class OrderService {
  constructor(private readonly repository: OrderRepository) {}

  async createQrOrder(input: unknown, sessionToken: string, clientIp: string) {
    return this.repository.createQrOrder(createQrOrderInputSchema.parse(input), sessionToken, clientIp);
  }

  async createCounterOrder(input: unknown, staffId: string) {
    return this.repository.createCounterOrder(createCounterOrderInputSchema.parse(input), staffId);
  }

  async confirmTraditionalPayment(orderId: string, input: unknown, staffId: string) {
    return this.repository.confirmTraditionalPayment(orderId, confirmTraditionalPaymentInputSchema.parse(input), staffId);
  }

  findCustomerOrder(orderId: string, customerSessionId: string) {
    return this.repository.findCustomerOrder(orderId, customerSessionId);
  }

  listPendingTraditionalPayments() {
    return this.repository.listPendingTraditionalPayments();
  }

  listStaffOrders() {
    return this.repository.listStaffOrders();
  }
}
