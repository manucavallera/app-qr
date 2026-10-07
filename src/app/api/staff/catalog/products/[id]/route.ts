import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { CatalogService } from "@/modules/catalog/catalog-service";
import { catalogRepository } from "@/modules/catalog/catalog-repository";
import { availabilityInputSchema, productImageInputSchema, productImagesInputSchema } from "@/modules/catalog/catalog-schemas";
import { DomainError } from "@/modules/orders/errors";

const catalog = new CatalogService(catalogRepository);
const staffRoles = ["ADMIN", "OPERATOR"] as const;
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;

  try {
    const { id } = await context.params;
    const product = await catalog.findProduct(id);
    if (!product) throw new DomainError("PRODUCT_NOT_FOUND", "No encontramos ese producto.");
    return NextResponse.json(principal.role === "ADMIN" ? product : { ...(product as object), costCents: null });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;

  const body: unknown = await request.json().catch(() => null);
  try {
    const { id } = await context.params;
    if (availabilityInputSchema.safeParse(body).success) {
      return NextResponse.json(await catalog.setAvailability(id, body, principal.userId));
    }
    if (productImagesInputSchema.safeParse(body).success) {
      return NextResponse.json(await catalog.setProductImages(id, body, principal.userId));
    }
    if (productImageInputSchema.safeParse(body).success) {
      return NextResponse.json(await catalog.setProductImage(id, body, principal.userId));
    }
    if (principal.role === "ADMIN" || typeof body !== "object" || body === null) return NextResponse.json(await catalog.updateProduct(id, body));
    // Operators never see the cost, so their edits must keep the one already loaded.
    const current = await catalog.findProduct(id) as { costCents?: number | null } | null;
    const updated = await catalog.updateProduct(id, { ...body, costCents: current?.costCents ?? null });
    return NextResponse.json({ ...(updated as object), costCents: null });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;

  try {
    const { id } = await context.params;
    await catalog.archiveProduct(id, principal.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
