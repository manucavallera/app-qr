import { describe, expect, it } from "vitest";
import { encodeSse, parseOrderEvent, type OrderChangedEvent } from "./events";

describe("realtime events", () => {
  it("serializes order changes as SSE", () => {
    const event: OrderChangedEvent = { type: "order.changed", orderId: "order-1", version: 4, occurredAt: "2026-09-21T20:00:00.000Z" };
    expect(encodeSse(event)).toBe('event: order.changed\ndata: {"orderId":"order-1","version":4,"occurredAt":"2026-09-21T20:00:00.000Z"}\n\n');
  });
  it("rejects unknown or oversized events", () => {
    expect(() => parseOrderEvent({ type: "other" })).toThrow();
    expect(() => encodeSse({ type: "order.changed", orderId: "x".repeat(5000), version: 1, occurredAt: new Date().toISOString() })).toThrow();
  });
});
