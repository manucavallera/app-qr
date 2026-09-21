import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";
import { createImageStorage } from "@/modules/catalog/storage";
import { resolveServiceMode } from "@/modules/operations/service-mode";

type RouteContext = { params: Promise<{ qrToken: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { qrToken } = await params;
  try {
    const table = await prisma.diningTable.findFirst({ where: { qrToken, active: true } });
    if (!table) return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 });

    const [settings, windows, categories] = await Promise.all([
      prisma.businessSettings.findUnique({ where: { id: "default" } }),
      prisma.serviceWindow.findMany(),
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

    return NextResponse.json({ table: { label: table.label }, mode, categories: publicCategories, serverTime: now.toISOString() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
