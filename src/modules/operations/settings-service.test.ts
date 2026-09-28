import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "./settings-service";

describe("SettingsService", () => {
  it("validates operational windows and role based manual modes", async () => {
    const repository = { updateSettings: async () => undefined, updateManualMode: async () => undefined };
    const service = new SettingsService(repository);
    await expect(service.update({ timezone: "Not/AZone", windows: [], manualMode: "SCHEDULED" }, "ADMIN")).rejects.toThrow();
    await expect(service.update({ timezone: "America/Argentina/Buenos_Aires", windows: [{ weekday: 1, opensAtMinute: 600, closesAtMinute: 1200, enabled: true }], manualMode: "FORCE_QR_OPEN" }, "OPERATOR")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.update({ manualMode: "FORCE_PAUSED" }, "OPERATOR")).resolves.toBeUndefined();
  });

  it("accepts midnight placeholders for disabled service windows", async () => {
    const repository = { updateSettings: async () => undefined };
    const service = new SettingsService(repository);

    await expect(service.update({
      timezone: "America/Argentina/Buenos_Aires",
      windows: [{ weekday: 1, opensAtMinute: 0, closesAtMinute: 0, enabled: false }],
      manualMode: "SCHEDULED",
      paymentSettings: {
        mercadoPagoEnabled: true,
        cashEnabled: true,
        cardAtCounterEnabled: true,
        bankTransferEnabled: false,
        bankAlias: null,
        bankCbuCvu: null,
        bankAccountHolder: null,
        bankInstructions: null,
      },
    }, "ADMIN")).resolves.toBeUndefined();

    await expect(service.update({
      timezone: "America/Argentina/Buenos_Aires",
      windows: [{ weekday: 1, opensAtMinute: 0, closesAtMinute: 0, enabled: true }],
      manualMode: "SCHEDULED",
    }, "ADMIN")).rejects.toThrow();
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
    const repository = { updateSettings: async () => undefined, updateManualMode: async () => undefined };
    const service = new SettingsService(repository);

    await expect(service.update({ manualMode: "SCHEDULED", businessProfile: { name: "Bar" } }, "OPERATOR")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets operators change only the temporary service mode", async () => {
    const updateManualMode = vi.fn().mockResolvedValue(undefined);
    const service = new SettingsService({ updateSettings: async () => undefined, updateManualMode });

    await expect(service.update({ manualMode: "FORCE_PAUSED" }, "OPERATOR", "operator-1")).resolves.toBeUndefined();
    expect(updateManualMode).toHaveBeenCalledWith("FORCE_PAUSED", "operator-1");
    await expect(service.update({ manualMode: "FORCE_COUNTER_ONLY" }, "OPERATOR", "operator-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
