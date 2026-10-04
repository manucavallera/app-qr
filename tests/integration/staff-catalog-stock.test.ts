import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as listProducts } from "@/app/api/staff/catalog/products/route";
import { hashToken } from "@/lib/security/token";
import { prisma } from "@/lib/db";
import { STAFF_SESSION_COOKIE } from "@/modules/auth/auth-service";
import { hashPassword } from "@/modules/auth/password";

const unique = randomUUID();
const token = `catalog-stock-${unique}`;
let userId = "";
let categoryId = "";

describe("staff catalog stock hints", () => {
  beforeAll(async () => {
    userId = (await prisma.staffUser.create({ data: { email: `catalog-stock-${unique}@local.test`, displayName: "Stock", passwordHash: await hashPassword("integration password"), role: "OPERATOR" } })).id;
    await prisma.staffSession.create({ data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + 3_600_000) } });
    categoryId = (await prisma.category.create({ data: { name: `Stock ${unique}` } })).id;
    await prisma.product.createMany({ data: [
      { categoryId, name: `Agotado ${unique}`, description: "x", priceCents: 1000, stockQuantity: 0 },
      { categoryId, name: `Poco ${unique}`, description: "x", priceCents: 1000, stockQuantity: 3 },
      { categoryId, name: `Mucho ${unique}`, description: "x", priceCents: 1000, stockQuantity: 50 },
      { categoryId, name: `Sin limite ${unique}`, description: "x", priceCents: 1000, stockQuantity: null },
    ] });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.staffSession.deleteMany({ where: { userId } });
    await prisma.staffUser.deleteMany({ where: { id: userId } });
  });

  it("reports the units left only when stock is running out", async () => {
    const response = await listProducts(new NextRequest("http://localhost/api/staff/catalog/products", { headers: { cookie: `${STAFF_SESSION_COOKIE}=${token}` } }));
    const products = await response.json() as { name: string; stockLeft: number | null }[];
    const left = (prefix: string) => products.find((product) => product.name.startsWith(prefix) && product.name.endsWith(unique))?.stockLeft;
    expect(left("Agotado")).toBe(0);
    expect(left("Poco")).toBe(3);
    expect(left("Mucho")).toBeNull();
    expect(left("Sin limite")).toBeNull();
  });
});
