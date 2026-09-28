type PaymentLike = Readonly<{ status: string }>;

export function selectCurrentPayment<T extends PaymentLike>(payments: readonly T[]): T | undefined {
  return payments.find((payment) => payment.status === "APPROVED")
    ?? payments.find((payment) => payment.status !== "REJECTED")
    ?? payments[0];
}
