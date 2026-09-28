type RefundValidationInput = Readonly<{
  paymentStatus: string;
  amountCents: number;
  refundedCents: number;
  requestedStatus: "REFUNDED" | "PARTIALLY_REFUNDED";
  requestedRefundedCents: number;
}>;

export function validateRefundRequest(input: RefundValidationInput): void {
  if (!(["APPROVED", "PARTIALLY_REFUNDED"] as string[]).includes(input.paymentStatus)) {
    throw new Error("Only approved payments can be refunded.");
  }
  if (input.requestedRefundedCents <= input.refundedCents || input.requestedRefundedCents > input.amountCents) {
    throw new Error("Refund amount exceeds the remaining amount.");
  }
  if (input.requestedStatus === "REFUNDED" && input.requestedRefundedCents !== input.amountCents) {
    throw new Error("A full refund must cover the full amount.");
  }
  if (input.requestedStatus === "PARTIALLY_REFUNDED" && input.requestedRefundedCents >= input.amountCents) {
    throw new Error("A partial refund must leave an amount remaining.");
  }
}
