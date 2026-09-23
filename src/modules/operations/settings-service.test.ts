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

  it("rejects malformed public links", async () => {
    const repository = { updateSettings: async () => undefined };
    const service = new SettingsService(repository);

    await expect(service.update({
      timezone: "America/Argentina/Buenos_Aires",
      windows: [],
      manualMode: "SCHEDULED",
      businessProfile: {
        name: "Bar",
        locationUrl: "maps",
        instagramUrl: null,
        whatsappUrl: null,
      },
    }, "ADMIN")).rejects.toMatchObject({ name: "ZodError" });
  });

  it("prevents operators from editing the public profile", async () => {
    const repository = { updateSettings: async () => undefined };
    const service = new SettingsService(repository);

    await expect(service.update({
      timezone: "America/Argentina/Buenos_Aires",
      windows: [],
      manualMode: "SCHEDULED",
      businessProfile: {
        name: "Bar",
        locationUrl: "https://maps.google.com/?q=bar",
        instagramUrl: "https://instagram.com/bar",
        whatsappUrl: "https://wa.me/5491100000000",
      },
    }, "OPERATOR")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
