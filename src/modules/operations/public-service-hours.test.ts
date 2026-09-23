import { describe, expect, it } from "vitest";
import { publicServiceHours } from "./public-service-hours";

describe("publicServiceHours", () => {
  it("uses the previous day's window after midnight", () => {
    expect(publicServiceHours(
      new Date("2026-09-19T03:30:00.000Z"),
      "America/Argentina/Buenos_Aires",
      [{ weekday: 5, opensAtMinute: 1080, closesAtMinute: 60, enabled: true }],
    )).toBe("18:00hs a 01:00hs");
  });

  it("omits disabled windows", () => {
    expect(publicServiceHours(
      new Date("2026-09-21T15:00:00.000Z"),
      "America/Argentina/Buenos_Aires",
      [{ weekday: 1, opensAtMinute: 600, closesAtMinute: 1200, enabled: false }],
    )).toBeNull();
  });

  it("formats midnight consistently", () => {
    expect(publicServiceHours(
      new Date("2026-09-21T15:00:00.000Z"),
      "America/Argentina/Buenos_Aires",
      [{ weekday: 1, opensAtMinute: 720, closesAtMinute: 1440, enabled: true }],
    )).toBe("12:00hs a 00:00hs");
  });
});
