import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/db", () => ({ prisma: {} }));

import { updateCategorySortOrders } from "./catalog-repository";

function sequentialUpdate(calls: string[]) {
  return async ({ where }: { where: { id: string } }) => {
    calls.push(`${where.id}:start`);
    await new Promise((resolve) => setTimeout(resolve, 1));
    calls.push(`${where.id}:end`);
  };
}

describe("updateCategorySortOrders", () => {
  it("updates categories one at a time inside an interactive transaction", async () => {
    const calls: string[] = [];
    await updateCategorySortOrders({ category: { update: sequentialUpdate(calls) } } as never, ["first", "second"]);

    expect(calls).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });
});
