import { describe, expect, it, vi } from "vitest";
import { CommandService } from "./command-service";

describe("CommandService", () => {
  it("rejects a transition without the expected version before persistence", async () => {
    const repository = { listCommands: vi.fn(), transitionOrder: vi.fn(), transitionItem: vi.fn() };
    const service = new CommandService(repository);
    await expect(service.transitionOrder("order-1", { targetStatus: "PREPARING", expectedVersion: 0 }, "staff-1", "OPERATOR"))
      .rejects.toMatchObject({ name: "ZodError" });
    expect(repository.transitionOrder).not.toHaveBeenCalled();
  });
});
