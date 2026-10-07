import { describe, expect, it } from "vitest";
import { businessDayStart } from "./business-day";

const zone = "America/Argentina/Buenos_Aires";
const start = (iso: string) => businessDayStart(new Date(iso), zone).toUTC().toISO();

describe("businessDayStart", () => {
  it("starts the day at 6:00 local time", () => {
    // 20:00 in Buenos Aires on the 15th.
    expect(start("2026-10-15T23:00:00.000Z")).toBe("2026-10-15T09:00:00.000Z");
    expect(start("2026-10-15T09:00:00.000Z")).toBe("2026-10-15T09:00:00.000Z");
  });

  it("counts the small hours as the previous day's shift", () => {
    // 2:00 and 5:59 in Buenos Aires on the 16th.
    expect(start("2026-10-16T05:00:00.000Z")).toBe("2026-10-15T09:00:00.000Z");
    expect(start("2026-10-16T08:59:00.000Z")).toBe("2026-10-15T09:00:00.000Z");
  });
});
