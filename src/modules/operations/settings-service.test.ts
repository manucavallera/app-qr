import { describe, expect, it } from "vitest";
import { SettingsService } from "./settings-service";

describe("SettingsService", () => {
  it("validates operational windows and role based manual modes", async () => {
    const repository = { updateSettings: async () => undefined };
    const service = new SettingsService(repository);
    await expect(service.update({ timezone: "Not/AZone", windows: [], manualMode: "SCHEDULED" }, "ADMIN")).rejects.toThrow();
    await expect(service.update({ timezone: "America/Argentina/Buenos_Aires", windows: [{ weekday: 1, opensAtMinute: 600, closesAtMinute: 1200, enabled: true }], manualMode: "FORCE_QR_OPEN" }, "OPERATOR")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.update({ timezone: "America/Argentina/Buenos_Aires", windows: [{ weekday: 1, opensAtMinute: 600, closesAtMinute: 1200, enabled: true }], manualMode: "FORCE_PAUSED" }, "OPERATOR")).resolves.toBeUndefined();
  });
});
