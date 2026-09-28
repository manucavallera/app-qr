import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { SettingsService } from "@/modules/operations/settings-service";
import { getServerEnv } from "@/lib/env";
const roles = ["ADMIN", "OPERATOR"] as const;

const defaultPaymentSettings = {
  id: "default",
  mercadoPagoEnabled: false,
  cashEnabled: true,
  cardAtCounterEnabled: true,
  bankTransferEnabled: false,
  bankAlias: null,
  bankCbuCvu: null,
  bankAccountHolder: null,
  bankInstructions: null,
};

export async function GET(request: NextRequest) {
  const principal = await requireStaff(request, roles);
  if (principal instanceof NextResponse) return principal;
  const env = getServerEnv();
  const [settings, windows, paymentSettings] = await Promise.all([
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
    prisma.serviceWindow.findMany({ orderBy: { weekday: "asc" } }),
    prisma.paymentSettings.findUnique({ where: { id: "default" } }),
  ]);
  return NextResponse.json({
    role: principal.role,
    settings,
    windows,
    paymentSettings: paymentSettings ?? defaultPaymentSettings,
    mercadoPagoConfigured: env.PAYMENT_PROVIDER === "mercadopago" && Boolean(env.MERCADOPAGO_ACCESS_TOKEN),
  });
}

export async function PATCH(request: NextRequest) {
  const principal = await requireStaff(request, roles);
  if (principal instanceof NextResponse) return principal;
  try {
    const body = await request.json();
    const service = new SettingsService({
      updateSettings: async (input, actor) => {
        await prisma.$transaction(async (tx) => {
          const before = await tx.businessSettings.findUnique({ where: { id: "default" } });
          const beforePayments = await tx.paymentSettings.findUnique({ where: { id: "default" } });
          const paymentSettings = input.paymentSettings ?? beforePayments ?? defaultPaymentSettings;
          await tx.businessSettings.upsert({
            where: { id: "default" },
            create: {
              id: "default",
              name: input.businessProfile?.name ?? "Bar",
              timezone: input.timezone,
              manualMode: input.manualMode,
              locationUrl: input.businessProfile?.locationUrl ?? null,
              instagramUrl: input.businessProfile?.instagramUrl ?? null,
              whatsappUrl: input.businessProfile?.whatsappUrl ?? null,
            },
            update: {
              timezone: input.timezone,
              manualMode: input.manualMode,
              ...(input.businessProfile ?? {}),
            },
          });
          await tx.paymentSettings.upsert({ where: { id: "default" }, create: paymentSettings, update: paymentSettings });
          await tx.serviceWindow.deleteMany();
          await tx.serviceWindow.createMany({ data: input.windows });
          await tx.auditEvent.create({
            data: {
              actorStaffId: actor,
              action: "SETTINGS_UPDATED",
              entityType: "BusinessSettings",
              entityId: "default",
              metadata: { before, beforePayments, after: input },
            },
          });
        });
      },
      updateManualMode: async (manualMode, actor) => {
        await prisma.$transaction(async (tx) => {
          const before = await tx.businessSettings.findUnique({ where: { id: "default" } });
          if (!before) throw new Error("Business settings are not configured.");
          await tx.businessSettings.update({ where: { id: "default" }, data: { manualMode } });
          await tx.auditEvent.create({ data: { actorStaffId: actor, action: "SETTINGS_UPDATED", entityType: "BusinessSettings", entityId: "default", metadata: { beforeManualMode: before.manualMode, afterManualMode: manualMode } } });
        });
      },
    });
    await service.update(body, principal.role, principal.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
