import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { assertOrderTransition } from "./order-state";

function expectDomainCode(action: () => void, code: string) {
  try {
    action();
    expect.fail(`Expected a DomainError with code ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
  }
}

describe("assertOrderTransition", () => {
  it.each([
    ["AWAITING_PAYMENT", "CONFIRMED"],
    ["CONFIRMED", "PREPARING"],
  ] as const)("allows %s to %s", (from, to) => {
    expect(() => assertOrderTransition(from, to, "OPERATOR")).not.toThrow();
  });

  it("rejects READY to PREPARING", () => {
    expectDomainCode(() => assertOrderTransition("READY", "PREPARING", "OPERATOR"), "INVALID_ORDER_TRANSITION");
  });

  it("does not let an operator cancel an order already in preparation", () => {
    expectDomainCode(
      () => assertOrderTransition("PREPARING", "CANCELLED", "OPERATOR", "Cliente se fue"),
      "ADMIN_REQUIRED_TO_CANCEL_IN_PREPARATION",
    );
  });

  it("lets an admin cancel a preparing order with a reason", () => {
    expect(() => assertOrderTransition("PREPARING", "CANCELLED", "ADMIN", "Error en cocina"))
      .not.toThrow();
  });

  it("requires a nonempty reason for an admin cancellation in preparation", () => {
    expectDomainCode(
      () => assertOrderTransition("PREPARING", "CANCELLED", "ADMIN", "   "),
      "CANCELLATION_REASON_REQUIRED",
    );
  });

  it.each(["READY", "DELIVERED"] as const)("never cancels an order in %s", (status) => {
    expectDomainCode(
      () => assertOrderTransition(status, "CANCELLED", "ADMIN", "Error"),
      "INVALID_ORDER_TRANSITION",
    );
  });
});
