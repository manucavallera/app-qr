import { describe, expect, it } from "vitest";
import { validateRefundRequest } from "./refund-validation";

describe("validateRefundRequest", () => {
  it("only allows refunds from approved payments and never above the remaining amount", () => {
    expect(() => validateRefundRequest({ paymentStatus: "UNPAID", amountCents: 5000, refundedCents: 0, requestedStatus: "REFUNDED", requestedRefundedCents: 5000 })).toThrow("approved");
    expect(() => validateRefundRequest({ paymentStatus: "APPROVED", amountCents: 5000, refundedCents: 3000, requestedStatus: "REFUNDED", requestedRefundedCents: 6000 })).toThrow("amount");
    expect(() => validateRefundRequest({ paymentStatus: "APPROVED", amountCents: 5000, refundedCents: 0, requestedStatus: "PARTIALLY_REFUNDED", requestedRefundedCents: 5000 })).toThrow("partial");
    expect(() => validateRefundRequest({ paymentStatus: "APPROVED", amountCents: 5000, refundedCents: 0, requestedStatus: "PARTIALLY_REFUNDED", requestedRefundedCents: 2000 })).not.toThrow();
  });
});
