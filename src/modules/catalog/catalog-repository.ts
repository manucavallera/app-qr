import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { DomainError } from "../orders/errors";
import type { CatalogProductInput, CategoryInput } from "./catalog-schemas";
import type { CatalogRepository } from "./catalog-service";

type TransactionClient = Prisma.TransactionClient;

function createOptionGroups(input: CatalogProductInput["optionGroups"]) {
  return input.map((group, groupIndex) => ({
    name: group.name,
    required: group.required,
    minSelections: group.minSelections,
    maxSelections: group.maxSelections,
    sortOrder: groupIndex,
    values: {
      create: group.values.map((value, index) => ({
        name: value.name,
        priceDeltaCents: value.priceDeltaCents,
        available: value.available,
        sortOrder: index,
      })),
    },
  }));
}

function productScalars(input: CatalogProductInput) {
  return {
    categoryId: input.categoryId,
    name: input.name,
    description: input.description,
    priceCents: input.priceCents,
    available: input.available,
    stockQuantity: input.stockQuantity,
    visible: input.visible,
    station: input.station,
    fulfillment: input.fulfillment,
    sortOrder: input.sortOrder,
  };
}

function includeCatalogOptions() {
  return {
    category: true,
    optionGroups: {
      orderBy: { sortOrder: "asc" as const },
      include: { values: { orderBy: { sortOrder: "asc" as const } } },
    },
  };
}

export async function updateCategorySortOrders(tx: TransactionClient, categoryIds: string[]): Promise<void> {
  for (const [sortOrder, id] of categoryIds.entries()) {
    await tx.category.update({ where: { id }, data: { sortOrder } });
  }
}

async function writeProduct(tx: TransactionClient, input: CatalogProductInput) {
  const category = await tx.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new DomainError("CATEGORY_NOT_FOUND", "No encontramos esa categoría.");

  return tx.product.create({
    data: {
      ...productScalars(input),
      optionGroups: { create: createOptionGroups(input.optionGroups) },
    },
    include: includeCatalogOptions(),
  });
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly db: PrismaClient) {}

  listCategories() {
    return this.db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }

  createCategory(input: CategoryInput) {
    return this.db.category.create({ data: input });
  }

  async reorderCategories(categoryIds: string[]) {
    if (new Set(categoryIds).size !== categoryIds.length) {
      throw new DomainError("INVALID_CATEGORY_ORDER", "La lista de categorías contiene duplicados.");
    }

    return this.db.$transaction(async (tx) => {
      const found = await tx.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true },
      });
      if (found.length !== categoryIds.length) {
        throw new DomainError("CATEGORY_NOT_FOUND", "No encontramos todas las categorías indicadas.");
      }

      await updateCategorySortOrders(tx, categoryIds);
      return tx.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    });
  }

  listProducts() {
    return this.db.product.findMany({
      include: includeCatalogOptions(),
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    });
  }

  findProduct(id: string) {
    return this.db.product.findUnique({ where: { id }, include: includeCatalogOptions() });
  }

  createProduct(input: CatalogProductInput) {
    return this.db.$transaction((tx) => writeProduct(tx, input));
  }

  updateProduct(id: string, input: CatalogProductInput) {
    return this.db.$transaction(async (tx) => {
      const exists = await tx.product.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new DomainError("PRODUCT_NOT_FOUND", "No encontramos ese producto.");

      await tx.optionGroup.deleteMany({ where: { productId: id } });
      const category = await tx.category.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new DomainError("CATEGORY_NOT_FOUND", "No encontramos esa categoría.");

      return tx.product.update({
        where: { id },
        data: {
          ...productScalars(input),
          optionGroups: { create: createOptionGroups(input.optionGroups) },
        },
        include: includeCatalogOptions(),
      });
    });
  }

  setAvailability(id: string, available: boolean, actorStaffId: string) {
    return this.db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id }, select: { id: true, available: true } });
      if (!product) throw new DomainError("PRODUCT_NOT_FOUND", "No encontramos ese producto.");

      const updated = await tx.product.update({ where: { id }, data: { available } });
      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: "PRODUCT_AVAILABILITY_CHANGED",
          entityType: "Product",
          entityId: id,
          metadata: { previous: product.available, available },
        },
      });
      return updated;
    });
  }

  setProductImage(id: string, imageKey: string | null, actorStaffId: string) {
    return this.db.$transaction(async (tx) => {
      const product = await tx.product.update({ where: { id }, data: { imageKey } });
      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: "PRODUCT_IMAGE_CHANGED",
          entityType: "Product",
          entityId: id,
          metadata: { hasImage: imageKey !== null },
        },
      });
      return product;
    });
  }

  async archiveProduct(id: string, actorStaffId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id }, select: { id: true, visible: true } });
      if (!product) throw new DomainError("PRODUCT_NOT_FOUND", "No encontramos ese producto.");

      await tx.product.update({ where: { id }, data: { visible: false } });
      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: "PRODUCT_ARCHIVED",
          entityType: "Product",
          entityId: id,
          metadata: { previouslyVisible: product.visible },
        },
      });
    });
  }
}

export const catalogRepository = new PrismaCatalogRepository(prisma);
