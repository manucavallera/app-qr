import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const closeExpiredSessions = vi.hoisted(() => vi.fn<() => Promise<{ closed: number }>>());

vi.mock("../src/modules/tables/session-cleanup", () => ({ closeExpiredSessions }));

import { register } from "../instrumentation";

describe("instrumentation", () => {
  let originalRuntime: string | undefined;

  beforeEach(() => {
    originalRuntime = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";
    closeExpiredSessions.mockResolvedValue({ closed: 0 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (originalRuntime === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = originalRuntime;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs the startup cleanup without keeping the build process alive", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    await register();

    expect(closeExpiredSessions).toHaveBeenCalledOnce();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
