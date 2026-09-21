import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { requireStaff } from "@/modules/auth/require-staff";
import { CatalogService } from "@/modules/catalog/catalog-service";
import { catalogRepository } from "@/modules/catalog/catalog-repository";
import { createImageStorage } from "@/modules/catalog/storage";

const catalog = new CatalogService(catalogRepository);
const staffRoles = ["ADMIN", "OPERATOR"] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;

  try {
    const products = await catalog.listProducts() as Array<{ imageKey: string | null; [key: string]: unknown }>;
    const storage = createImageStorage();
    return NextResponse.json(products.map((product) => ({
      ...product,
      imageUrl: product.imageKey ? storage.publicUrl(product.imageKey) : null,
    })));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const principal = await requireStaff(request, staffRoles);
  if (principal instanceof NextResponse) return principal;

  const body: unknown = await request.json().catch(() => null);
  try {
    return NextResponse.json(await catalog.createProduct(body), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
