import { DateTime } from "luxon";
import { z } from "zod";
import { DomainError } from "../orders/errors";

const windowSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  opensAtMinute: z.number().int().min(0).max(1439),
  closesAtMinute: z.number().int().min(0).max(1440),
  enabled: z.boolean(),
}).superRefine((window, context) => {
  if (!window.enabled) return;
  if (window.closesAtMinute === 0) {
    context.addIssue({ code: "custom", path: ["closesAtMinute"], message: "Indicá un horario de cierre." });
  }
  if (window.opensAtMinute === window.closesAtMinute) {
    context.addIssue({ code: "custom", path: ["closesAtMinute"], message: "La apertura y el cierre deben ser distintos." });
  }
});
const paymentSettingsSchema = z.object({
  mercadoPagoEnabled: z.boolean(),
  cashEnabled: z.boolean(),
  cardAtCounterEnabled: z.boolean(),
  bankTransferEnabled: z.boolean(),
  tabEnabled: z.boolean().default(false),
  bankAlias: z.string().trim().max(120).nullable(),
  bankCbuCvu: z.string().trim().max(120).nullable(),
  bankAccountHolder: z.string().trim().max(120).nullable(),
  bankInstructions: z.string().trim().max(500).nullable(),
}).superRefine((settings, context) => {
  if (settings.bankTransferEnabled && !settings.bankAlias && !settings.bankCbuCvu) {
    context.addIssue({ code: "custom", path: ["bankAlias"], message: "Configurá un alias o CBU/CVU para habilitar transferencias." });
  }
});
const optionalPublicUrl = z.string().trim().max(500).url().nullable();
const businessProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  locationUrl: optionalPublicUrl,
  instagramUrl: optionalPublicUrl,
  whatsappUrl: optionalPublicUrl,
});
const inputSchema = z.object({
  timezone: z.string().refine((value) => DateTime.now().setZone(value).isValid, "Zona horaria inválida"),
  windows: z.array(windowSchema).max(7),
  manualMode: z.enum(["SCHEDULED", "FORCE_QR_OPEN", "FORCE_COUNTER_ONLY", "FORCE_PAUSED"]),
  paymentSettings: paymentSettingsSchema.optional(),
  businessProfile: businessProfileSchema.optional(),
});
const operatorModeSchema = z.object({ manualMode: z.enum(["SCHEDULED", "FORCE_PAUSED"]) }).strict();
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type SettingsInput = z.infer<typeof inputSchema>;
export type SettingsRepository = {
  updateSettings(input: SettingsInput, actorStaffId: string): Promise<void>;
  updateManualMode?: (manualMode: "SCHEDULED" | "FORCE_PAUSED", actorStaffId: string) => Promise<void>;
};

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}
  async update(input: unknown, role: "ADMIN" | "OPERATOR", actorStaffId = "") {
    if (role === "OPERATOR") {
      const parsed = operatorModeSchema.safeParse(input);
      if (!parsed.success) throw new DomainError("FORBIDDEN", "Solo podés pausar o reanudar temporalmente los pedidos QR.");
      if (!this.repository.updateManualMode) throw new DomainError("INTERNAL_SERVER_ERROR", "No se pudo actualizar el modo operativo.");
      return this.repository.updateManualMode(parsed.data.manualMode, actorStaffId);
    }
    const parsed = inputSchema.parse(input);
    return this.repository.updateSettings(parsed, actorStaffId);
  }
}
