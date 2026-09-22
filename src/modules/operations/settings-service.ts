import { DateTime } from "luxon";
import { z } from "zod";
import { DomainError } from "../orders/errors";

const windowSchema = z.object({ weekday: z.number().int().min(1).max(7), opensAtMinute: z.number().int().min(0).max(1439), closesAtMinute: z.number().int().min(1).max(1440), enabled: z.boolean() }).refine((window) => window.opensAtMinute !== window.closesAtMinute, "La apertura y el cierre deben ser distintos");
const paymentSettingsSchema = z.object({
  mercadoPagoEnabled: z.boolean(),
  cashEnabled: z.boolean(),
  cardAtCounterEnabled: z.boolean(),
  bankTransferEnabled: z.boolean(),
  bankAlias: z.string().trim().max(120).nullable(),
  bankCbuCvu: z.string().trim().max(120).nullable(),
  bankAccountHolder: z.string().trim().max(120).nullable(),
  bankInstructions: z.string().trim().max(500).nullable(),
}).superRefine((settings, context) => {
  if (settings.bankTransferEnabled && !settings.bankAlias && !settings.bankCbuCvu) {
    context.addIssue({ code: "custom", path: ["bankAlias"], message: "Configurá un alias o CBU/CVU para habilitar transferencias." });
  }
});
const inputSchema = z.object({
  timezone: z.string().refine((value) => DateTime.now().setZone(value).isValid, "Zona horaria inválida"),
  windows: z.array(windowSchema).max(7),
  manualMode: z.enum(["SCHEDULED", "FORCE_QR_OPEN", "FORCE_COUNTER_ONLY", "FORCE_PAUSED"]),
  paymentSettings: paymentSettingsSchema.optional(),
});
export type SettingsInput = z.infer<typeof inputSchema>;
export type SettingsRepository = { updateSettings(input: SettingsInput, actorStaffId: string): Promise<void> };

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}
  async update(input: unknown, role: "ADMIN" | "OPERATOR", actorStaffId = "") {
    const parsed = inputSchema.parse(input);
    if (role === "OPERATOR" && ["FORCE_QR_OPEN", "FORCE_COUNTER_ONLY"].includes(parsed.manualMode)) throw new DomainError("FORBIDDEN", "No tenés permisos para aplicar ese modo.");
    if (role === "OPERATOR" && parsed.paymentSettings) throw new DomainError("FORBIDDEN", "No tenés permisos para modificar los medios de pago.");
    return this.repository.updateSettings(parsed, actorStaffId);
  }
}
