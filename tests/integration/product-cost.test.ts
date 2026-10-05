import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as listProducts } from "@/app/api/staff/catalog/products/route";
import { PATCH as updateProduct } from "@/app/api/staff/catalog/products/[id]/route";
import { POST as createOrder } from "@/app/api/staff/orders/route";
import { hashToken } from "@/lib/security/token";
import { prisma } from "@/lib/db";
import { STAFF_SESSION_COOKIE, type StaffRole } from "@/modules/auth/auth-service";
import { hashPassword } from "@/modules/auth/password";

const unique = randomUUID();
const tokens: Record<StaffRole, string> = { ADMIN: `cost-admin-${unique}`, OPERATOR: `cost-operator-${unique}` };
const userIds: string[] = [];
let categoryId = "";
let productId = "";

const request = (role: StaffRole, url: string, init?: { method: string; body: unknown }) => new NextRequest(`http://localhost${url}`, {
  method: init?.method ?? "GET",
  headers: { "content-type": "application/json", cookie: `${STAFF_SESSION_COOKIE}=${tokens[role]}` },
  ...(init ? { body: JSON.stringify(init.body) } : {}),
});
const productBody = (extra: Record<string, unknown>) => ({ categoryId, name: `Costo ${unique}`, description: "x", priceCents: 1000, available: true, visible: true, station: "GENERAL", fulfillment: "TABLE", sortOrder: 0, optionGroups: [], ...extra });
const storedCost = async () => (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).costCents;

describe("product cost", () => {
  beforeAll(async () => {
    for (const role of ["ADMIN", "OPERATOR"] as const) {
      const user = await prisma.staffUser.create({ data: { email: `cost-${role.toLowerCase()}-${unique}@local.test`, displayName: role, passwordHash: await hashPassword("integration password"), role } });
      userIds.push(user.id);
      await prisma.staffSession.create({ data: { tokenHash: hashToken(tokens[role]), userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } });
    }
    categoryId = (await prisma.category.create({ data: { name: `Costo ${unique}` } })).id;
    productId = (await prisma.product.create({ data: { categoryId, name: `Costo ${unique}`, description: "x", priceCents: 1000, costCents: 400 } })).id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { createdByStaffId: { in: userIds } } });
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.auditEvent.deleteMany({ where: { actorStaffId: { in: userIds } } });
    await prisma.staffSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.staffUser.deleteMany({ where: { id: { in: userIds } } });
  });

  it("shows the cost to the admin and hides it from operators", async () => {
    const costFor = async (role: StaffRole) => {
      const products = await (await listProducts(request(role, "/api/staff/catalog/products"))).json() as { id: string; costCents: number | null }[];
      return products.find((product) => product.id === productId)?.costCents;
    };

    expect(await costFor("ADMIN")).toBe(400);
    expect(await costFor("OPERATOR")).toBeNull();
  });

  it("keeps the stored cost when an operator edits the product, and lets the admin change it", async () => {
    const patch = (role: StaffRole, body: unknown) => updateProduct(request(role, `/api/staff/catalog/products/${productId}`, { method: "PATCH", body }), { params: Promise.resolve({ id: productId }) });

    const operatorResponse = await patch("OPERATOR", productBody({ description: "editado", costCents: 1 }));
    expect(operatorResponse.status).toBe(200);
    expect((await operatorResponse.json() as { costCents: number | null }).costCents).toBeNull();
    expect(await storedCost()).toBe(400);

    expect((await patch("ADMIN", productBody({ costCents: 450 }))).status).toBe(200);
    expect(await storedCost()).toBe(450);
  });

  it("freezes the cost on the order line so later changes do not rewrite past profit", async () => {
    const response = await createOrder(request("ADMIN", "/api/staff/orders", { method: "POST", body: { clientRequestId: randomUUID(), nickname: "Costo", paymentMethod: "CASH", expectedTotalCents: 2000, items: [{ productId, quantity: 2, optionValueIds: [] }] } }));
    expect(response.status).toBe(201);
    const { id } = await response.json() as { id: string };

    await prisma.product.update({ where: { id: productId }, data: { costCents: 900 } });

    expect(await prisma.orderItem.findMany({ where: { orderId: id }, select: { unitCostCents: true, lineTotalCents: true } })).toEqual([{ unitCostCents: 450, lineTotalCents: 2000 }]);
  });
});
