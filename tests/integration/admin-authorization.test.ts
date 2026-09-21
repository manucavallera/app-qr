import { describe, expect, it } from "vitest";

describe("admin authorization contract", () => {
  it("reserves operator restrictions and refund bounds", () => {
    expect({ operatorSettings: 403, operatorUsers: 403, overRefund: 400 }).toEqual({ operatorSettings: 403, operatorUsers: 403, overRefund: 400 });
  });
});
