import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getQr, POST as regenerateQr } from "@/app/api/staff/tables/[id]/qr/route";
import { POST as uploadImage } from "@/app/api/staff/catalog/images/route";
import { GET as listProducts } from "@/app/api/staff/catalog/products/route";
import { GET as getUploadedImage } from "@/app/uploads/[key]/route";
import { AuthService } from "@/modules/auth/auth-service";
import { PrismaSessionRepository } from "@/modules/auth/session-repository";
import { hashPassword } from "@/modules/auth/password";
import { CatalogService } from "@/modules/catalog/catalog-service";
import { PrismaCatalogRepository } from "@/modules/catalog/catalog-repository";
import { createImageStorage } from "@/modules/catalog/storage";
import { TableService, PrismaTableRepository } from "@/modules/tables/table-service";
import { prisma } from "@/lib/db";

const suffix = randomUUID();
const staffEmail = `catalog-${suffix}@local.test`;
const categoryOneName = `Categoría A ${suffix}`;
const categoryTwoName = `Categoría B ${suffix}`;
const productName = `Producto prueba ${suffix}`;
const tableLabel = `Mesa prueba ${suffix}`;

const catalog = new CatalogService(new PrismaCatalogRepository(prisma));
const tableService = new TableService(new PrismaTableRepository(prisma));
const authService = new AuthService(new PrismaSessionRepository(prisma));
let staffId: string;
let categoryOneId: string;
let categoryTwoId: string;
let productId: string;
let orderId: string;
let tableId: string;
let staffCookie: string;
let uploadedImageKey: string | undefined;

const productInput = (categoryId: string) => ({
  categoryId,
  name: productName,
  description: "Producto de integración",
  priceCents: 150_000,
  available: true,
  visible: true,
  station: "KITCHEN" as const,
  fulfillment: "TABLE" as const,
  sortOrder: 0,
  optionGroups: [
    {
      name: "Punto",
      required: true,
      minSelections: 1,
      maxSelections: 1,
      values: [{ name: "A punto", priceDeltaCents: 0, available: true }],
    },
  ],
});

function staffRequest(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", staffCookie);
  const { signal, ...requestInit } = init;
  return new NextRequest(url, { ...requestInit, ...(signal ? { signal } : {}), headers });
}

describe("catalog and table administration integration", () => {
  beforeAll(async () => {
    const staff = await prisma.staffUser.create({
      data: {
        email: staffEmail,
        displayName: "Admin de catálogo",
        passwordHash: await hashPassword("catalog integration password"),
        role: "ADMIN",
      },
    });
    staffId = staff.id;
    const session = await authService.login(staffEmail, "catalog integration password");
    staffCookie = `staff_session=${session.token}`;

    const categoryOne = await catalog.createCategory({ name: categoryOneName, sortOrder: 0, visible: true }) as { id: string };
    const categoryTwo = await catalog.createCategory({ name: categoryTwoName, sortOrder: 1, visible: true }) as { id: string };
    categoryOneId = categoryOne.id;
    categoryTwoId = categoryTwo.id;
  });

  afterAll(async () => {
    if (uploadedImageKey) await createImageStorage().delete(uploadedImageKey);
    if (orderId) await prisma.order.deleteMany({ where: { id: orderId } });
    const entityIds = [productId, tableId].filter(Boolean);
    if (entityIds.length > 0) await prisma.auditEvent.deleteMany({ where: { entityId: { in: entityIds } } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (categoryOneId || categoryTwoId) {
      await prisma.category.deleteMany({ where: { id: { in: [categoryOneId, categoryTwoId].filter(Boolean) } } });
    }
    if (tableId) await prisma.diningTable.deleteMany({ where: { id: tableId } });
    if (staffId) await prisma.staffUser.deleteMany({ where: { id: staffId } });
  });

  it("reorders categories and preserves historical option snapshots when replacing a product", async () => {
    const reordered = await catalog.reorderCategories({ categoryIds: [categoryTwoId, categoryOneId] }) as Array<{ id: string; sortOrder: number }>;
    expect(reordered.slice(0, 2).map((category) => [category.id, category.sortOrder])).toEqual([
      [categoryTwoId, 0],
      [categoryOneId, 1],
    ]);

    const product = await catalog.createProduct(productInput(categoryOneId)) as {
      id: string;
      priceCents: number;
      optionGroups: Array<{ values: Array<{ id: string }> }>;
    };
    productId = product.id;
    const optionValueId = product.optionGroups[0]!.values[0]!.id;
    const order = await prisma.order.create({
      data: {
        clientRequestId: randomUUID(),
        origin: "QR",
        totalCents: product.priceCents,
      },
    });
    orderId = order.id;
    await prisma.orderItem.create({
      data: {
        orderId,
        productId,
        productName,
        quantity: 1,
        unitBaseCents: product.priceCents,
        optionsTotalCents: 0,
        lineTotalCents: product.priceCents,
        station: "KITCHEN",
        fulfillment: "TABLE",
        options: {
          create: [{
            optionValueId,
            groupName: "Punto",
            valueName: "A punto",
            priceDeltaCents: 0,
          }],
        },
      },
    });

    await catalog.updateProduct(productId, {
      ...productInput(categoryOneId),
      name: `${productName} editado`,
      optionGroups: [{
        name: "Tamaño",
        required: false,
        minSelections: 0,
        maxSelections: 1,
        values: [{ name: "Grande", priceDeltaCents: 40_000, available: true }],
      }],
    });

    const historicalOption = await prisma.orderItemOption.findFirst({ where: { orderItem: { orderId } } });
    expect(historicalOption).toMatchObject({
      optionValueId: null,
      groupName: "Punto",
      valueName: "A punto",
      priceDeltaCents: 0,
    });

    await catalog.setAvailability(productId, { available: false }, staffId);
    await expect(prisma.product.findUnique({ where: { id: productId } })).resolves.toMatchObject({ available: false });
    await expect(prisma.auditEvent.findFirst({ where: { entityId: productId, action: "PRODUCT_AVAILABILITY_CHANGED" } }))
      .resolves.toMatchObject({ actorStaffId: staffId });
  });

  it("uploads a signature-verified image, rejects SVG, and returns its public URL", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const form = new FormData();
    form.set("file", new File([png], "menu.png", { type: "image/png" }));
    const response = await uploadImage(staffRequest("http://localhost/api/staff/catalog/images", {
      method: "POST",
      body: form,
    }));
    const result = (await response.json()) as { key: string; url: string };
    uploadedImageKey = result.key;

    expect(response.status).toBe(201);
    expect(result.key).toMatch(/^[A-Za-z0-9_-]+\.png$/);
    expect(result.url).toBe(`/uploads/${encodeURIComponent(result.key)}`);

    await catalog.setProductImage(productId, { imageKey: result.key }, staffId);
    const listed = await listProducts(staffRequest("http://localhost/api/staff/catalog/products"));
    expect(listed.status).toBe(200);
    const products = (await listed.json()) as Array<{ id: string; imageUrl: string | null }>;
    expect(products.find((product) => product.id === productId)?.imageUrl).toBe(result.url);

    const served = await getUploadedImage(new Request(`http://localhost${result.url}`), {
      params: Promise.resolve({ key: result.key }),
    });
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");

    const spoofedForm = new FormData();
    spoofedForm.set("file", new File(["not a png"], "fake.png", { type: "image/png" }));
    const spoofed = await uploadImage(staffRequest("http://localhost/api/staff/catalog/images", {
      method: "POST",
      body: spoofedForm,
    }));
    expect(spoofed.status).toBe(415);

    const svgForm = new FormData();
    svgForm.set("file", new File(["<svg></svg>"], "menu.svg", { type: "image/svg+xml" }));
    const rejected = await uploadImage(staffRequest("http://localhost/api/staff/catalog/images", {
      method: "POST",
      body: svgForm,
    }));
    expect(rejected.status).toBe(415);
  });

  it("regenerates a table token and returns the QR as an SVG download", async () => {
    const table = await tableService.create({ label: tableLabel }, staffId);
    tableId = table.id;
    expect(table.qrToken).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const qrResponse = await getQr(
      staffRequest(`http://localhost/api/staff/tables/${tableId}/qr`),
      { params: Promise.resolve({ id: tableId }) },
    );
    expect(qrResponse.status).toBe(200);
    expect(qrResponse.headers.get("content-type")).toContain("image/svg+xml");
    expect(qrResponse.headers.get("cache-control")).toBe("no-store");
    await expect(qrResponse.text()).resolves.toContain("<svg");

    const response = await regenerateQr(
      staffRequest(`http://localhost/api/staff/tables/${tableId}/qr`, { method: "POST" }),
      { params: Promise.resolve({ id: tableId }) },
    );
    const updated = await prisma.diningTable.findUnique({ where: { id: tableId } });
    expect(response.status).toBe(200);
    expect(updated?.qrToken).not.toBe(table.qrToken);
    expect(updated?.qrToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    await expect(prisma.auditEvent.findFirst({ where: { entityId: tableId, action: "TABLE_QR_REGENERATED" } }))
      .resolves.toMatchObject({ actorStaffId: staffId });
  });
});
