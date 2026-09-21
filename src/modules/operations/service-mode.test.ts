import { describe, expect, it } from "vitest";
import { resolveServiceMode } from "./service-mode";

describe("resolveServiceMode", () => {
  const timezone = "America/Argentina/Buenos_Aires";

  it("keeps a cross-midnight Friday window open on Saturday at 00:30", () => {
    const windows = [
      { weekday: 5, opensAtMinute: 1080, closesAtMinute: 60, enabled: true },
    ];
    const now = new Date("2026-09-19T03:30:00.000Z");

    expect(resolveServiceMode(now, timezone, windows, "SCHEDULED")).toBe("QR_OPEN");
  });

  it("closes the same window at its exact cutoff", () => {
    const windows = [
      { weekday: 5, opensAtMinute: 1080, closesAtMinute: 60, enabled: true },
    ];
    const now = new Date("2026-09-19T04:00:00.000Z");

    expect(resolveServiceMode(now, timezone, windows, "SCHEDULED")).toBe("COUNTER_ONLY");
  });

  it.each([
    ["FORCE_QR_OPEN", "QR_OPEN"],
    ["FORCE_COUNTER_ONLY", "COUNTER_ONLY"],
    ["FORCE_PAUSED", "PAUSED"],
  ] as const)("honors %s before the saved schedule", (manualMode, expected) => {
    expect(resolveServiceMode(new Date("2026-09-19T04:00:00.000Z"), timezone, [], manualMode)).toBe(
      expected,
    );
  });

  it("opens at the configured start minute and does not use disabled windows", () => {
    const windows = [
      { weekday: 6, opensAtMinute: 0, closesAtMinute: 60, enabled: false },
      { weekday: 6, opensAtMinute: 60, closesAtMinute: 180, enabled: true },
    ];

    expect(resolveServiceMode(new Date("2026-09-19T04:00:00.000Z"), timezone, windows, "SCHEDULED"))
      .toBe("QR_OPEN");
  });
});
