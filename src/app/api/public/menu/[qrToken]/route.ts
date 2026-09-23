import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { createImageStorage } from "@/modules/catalog/storage";
import { resolveServiceMode } from "@/modules/operations/service-mode";
import { availablePaymentMethods, type PaymentSettingsView } from "@/modules/payments/payment-methods";
import { getServerEnv } from "@/lib/env";

type RouteContext = { params: Promise<{ qrToken: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { qrToken } = await params;
  try {
    const table = await prisma.diningTable.findFirst({ where: { qrToken, active: true } });
    if (!table) return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 });

    const [settings, windows, paymentSettings, categories] = await Promise.all([
      prisma.businessSettings.findUnique({ where: { id: "default" } }),
      prisma.serviceWindow.findMany(),
      prisma.paymentSettings.findUnique({ where: { id: "default" } }),
      prisma.category.findMany({
        where: { visible: true },
        orderBy: { sortOrder: "asc" },
        include: {
          products: {
            where: { visible: true },
            orderBy: { sortOrder: "asc" },
            include: {
              optionGroups: {
                orderBy: { sortOrder: "asc" },
                include: {
                  values: { where: { available: true }, orderBy: { sortOrder: "asc" } },
                },
              },
            },
          },
        },
      }),
    ]);
    const now = new Date();
    const env = getServerEnv();
    const defaultPaymentSettings: PaymentSettingsView = {
      mercadoPagoEnabled: false,
      cashEnabled: true,
      cardAtCounterEnabled: true,
      bankTransferEnabled: false,
      bankAlias: null,
      bankCbuCvu: null,
      bankAccountHolder: null,
      bankInstructions: null,
    };
    const paymentConfiguration = paymentSettings ?? defaultPaymentSettings;
    const paymentMethods = availablePaymentMethods(paymentConfiguration, {
      mercadoPagoConfigured: env.PAYMENT_PROVIDER === "mercadopago" && Boolean(env.MERCADOPAGO_ACCESS_TOKEN),
    });
    const mode = settings
      ? resolveServiceMode(now, settings.timezone, windows, settings.manualMode)
      : "COUNTER_ONLY";
    const storage = createImageStorage();
    const publicCategories = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        products: category.products.map((product) => {
          const optionGroups = product.optionGroups.map((group) => ({
            id: group.id,
            name: group.name,
            required: group.required,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            values: group.values.map((value) => ({
              id: value.id,
              name: value.name,
              priceDeltaCents: value.priceDeltaCents,
            })),
          }));
          return {
            id: product.id,
            name: product.name,
            description: product.description,
            imageUrl: product.imageKey ? storage.publicUrl(product.imageKey) : null,
            priceCents: product.priceCents,
            available: product.available && optionGroups.every((group) => group.minSelections <= group.values.length),
            fulfillment: product.fulfillment,
            optionGroups,
          };
        }),
      }))
      .filter((category) => category.products.length > 0);

    return NextResponse.json({
      table: { label: table.label },
      mode,
      categories: publicCategories,
      payment: {
        methods: paymentMethods,
        transfer: paymentMethods.includes("BANK_TRANSFER") ? {
          alias: paymentConfiguration.bankAlias,
          cbuCvu: paymentConfiguration.bankCbuCvu,
          accountHolder: paymentConfiguration.bankAccountHolder,
          instructions: paymentConfiguration.bankInstructions,
        } : null,
      },
      serverTime: now.toISOString(),
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
