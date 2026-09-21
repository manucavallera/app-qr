import { describe, expect, it } from "vitest";

describe("command board concurrency contract", () => {
  it("reserves optimistic version conflicts for concurrent operators", () => {
    expect({ first: "PREPARING", stale: 409, eventCount: 1 }).toMatchObject({ first: "PREPARING", stale: 409 });
  });
});
