import { z } from "zod";

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
  optionValueIds: z.array(z.string().uuid()).max(30),
  notes: z.string().trim().max(160).optional(),
}).strict();

export const createQrOrderInputSchema = z.object({
  clientRequestId: z.string().uuid(),
  expectedTotalCents: z.number().int().min(0).max(2_000_000_000),
  paymentMethod: z.enum(["MERCADO_PAGO", "CASH", "CARD_AT_COUNTER", "BANK_TRANSFER", "ON_TAB"]),
  items: z.array(orderItemInputSchema).min(1).max(30),
}).strict();

export const createCounterOrderInputSchema = createQrOrderInputSchema.extend({
  nickname: z.string().trim().min(1).max(40),
  tableId: z.string().uuid().optional(),
  paymentMethod: z.enum(["CASH", "CARD_AT_COUNTER", "BANK_TRANSFER", "MERCADO_PAGO", "ON_TAB"]),
}).strict().refine((order) => order.paymentMethod !== "ON_TAB" || Boolean(order.tableId), { path: ["tableId"], message: "Elegí la mesa para sumar el pedido a su cuenta." });

export const confirmTraditionalPaymentInputSchema = z.object({
  method: z.enum(["CASH", "CARD_AT_COUNTER", "BANK_TRANSFER"]),
  expectedOrderVersion: z.number().int().min(1),
}).strict();

export const rejectTraditionalPaymentInputSchema = z.object({
  reason: z.string().trim().min(3).max(240),
  expectedOrderVersion: z.number().int().min(1),
}).strict();

export type CreateQrOrderInput = z.infer<typeof createQrOrderInputSchema>;
export type CreateCounterOrderInput = z.infer<typeof createCounterOrderInputSchema>;
export type ConfirmTraditionalPaymentInput = z.infer<typeof confirmTraditionalPaymentInputSchema>;
export type RejectTraditionalPaymentInput = z.infer<typeof rejectTraditionalPaymentInputSchema>;
