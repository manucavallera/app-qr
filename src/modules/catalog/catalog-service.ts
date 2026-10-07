import { DomainError } from "../orders/errors";
import {
  availabilityInputSchema,
  catalogProductInputSchema,
  categoryOrderInputSchema,
  categoryInputSchema,
  productImageInputSchema,
  productImagesInputSchema,
  type CatalogProductInput,
  type CategoryInput,
} from "./catalog-schemas";

export type CatalogRepository = {
  listCategories(): Promise<unknown[]>;
  createCategory(input: CategoryInput): Promise<unknown>;
  reorderCategories(categoryIds: string[]): Promise<unknown[]>;
  listProducts(): Promise<unknown[]>;
  findProduct(id: string): Promise<unknown | null>;
  createProduct(input: CatalogProductInput): Promise<unknown>;
  updateProduct(id: string, input: CatalogProductInput): Promise<unknown>;
  setAvailability(id: string, available: boolean, actorStaffId: string): Promise<unknown>;
  setProductImage(id: string, imageKey: string | null, actorStaffId: string): Promise<unknown>;
  setProductImages(id: string, imageKeys: string[], actorStaffId: string): Promise<unknown>;
  archiveProduct(id: string, actorStaffId: string): Promise<void>;
};

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  listCategories() {
    return this.repository.listCategories();
  }

  createCategory(input: unknown) {
    return this.repository.createCategory(categoryInputSchema.parse(input));
  }

  reorderCategories(input: unknown) {
    return this.repository.reorderCategories(categoryOrderInputSchema.parse(input).categoryIds);
  }

  listProducts() {
    return this.repository.listProducts();
  }

  findProduct(id: string) {
    return this.repository.findProduct(id);
  }

  createProduct(input: unknown) {
    return this.repository.createProduct(catalogProductInputSchema.parse(input));
  }

  updateProduct(id: string, input: unknown) {
    return this.repository.updateProduct(id, catalogProductInputSchema.parse(input));
  }

  setAvailability(id: string, input: unknown, actorStaffId: string) {
    const parsed = availabilityInputSchema.parse(input);
    return this.repository.setAvailability(id, parsed.available, actorStaffId);
  }

  setProductImage(id: string, input: unknown, actorStaffId: string) {
    const parsed = productImageInputSchema.parse(input);
    return this.repository.setProductImage(id, parsed.imageKey, actorStaffId);
  }

  setProductImages(id: string, input: unknown, actorStaffId: string) {
    const parsed = productImagesInputSchema.parse(input);
    return this.repository.setProductImages(id, parsed.imageKeys, actorStaffId);
  }

  async archiveProduct(id: string, actorStaffId: string): Promise<void> {
    const product = await this.repository.findProduct(id);
    if (!product) throw new DomainError("PRODUCT_NOT_FOUND", "No encontramos ese producto.");
    await this.repository.archiveProduct(id, actorStaffId);
  }
}
