import { describe, expect, it, vi } from "vitest";
import { CatalogService } from "./catalog-service";
import { catalogProductInputSchema, MAX_PRODUCT_IMAGES, productImagesInputSchema } from "./catalog-schemas";

const validProduct = {
  categoryId: "123e4567-e89b-12d3-a456-426614174000",
  name: "Hamburguesa clásica",
  description: "Con queso y tomate.",
  priceCents: 1_000_000,
  available: true,
  visible: true,
  station: "KITCHEN",
  fulfillment: "TABLE",
  sortOrder: 0,
  optionGroups: [
    {
      name: "Punto de cocción",
      required: true,
      minSelections: 1,
      maxSelections: 1,
      values: [{ name: "A punto", priceDeltaCents: 0, available: true }],
    },
  ],
};

describe("catalogProductInputSchema", () => {
  it("accepts a valid product and trims customer-facing text", () => {
    const result = catalogProductInputSchema.parse({
      ...validProduct,
      name: "  Hamburguesa clásica  ",
      optionGroups: [{
        ...validProduct.optionGroups[0],
        name: " Punto de cocción ",
        values: [{ ...validProduct.optionGroups[0].values[0], name: " A punto " }],
      }],
    });

    expect(result.name).toBe("Hamburguesa clásica");
    expect(result.optionGroups[0]?.values[0]?.name).toBe("A punto");
  });

  it("requires minSelections to be no greater than maxSelections", () => {
    const result = catalogProductInputSchema.safeParse({
      ...validProduct,
      optionGroups: [{ ...validProduct.optionGroups[0], minSelections: 2, maxSelections: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("minSelections"))).toBe(true);
    }
  });

  it("requires required groups to have at least one required selection", () => {
    const result = catalogProductInputSchema.safeParse({
      ...validProduct,
      optionGroups: [{ ...validProduct.optionGroups[0], required: true, minSelections: 0 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("minSelections"))).toBe(true);
    }
  });
});

describe("productImagesInputSchema", () => {
  it("accepts up to the maximum number of photos and an empty list", () => {
    expect(productImagesInputSchema.safeParse({ imageKeys: [] }).success).toBe(true);
    expect(productImagesInputSchema.safeParse({ imageKeys: ["a.jpg", "b.jpg", "c.jpg"] }).success).toBe(true);
    expect(MAX_PRODUCT_IMAGES).toBe(3);
  });

  it("rejects more photos than the maximum, empty keys and unknown fields", () => {
    expect(productImagesInputSchema.safeParse({ imageKeys: ["a", "b", "c", "d"] }).success).toBe(false);
    expect(productImagesInputSchema.safeParse({ imageKeys: [""] }).success).toBe(false);
    expect(productImagesInputSchema.safeParse({ imageKeys: [], other: 1 }).success).toBe(false);
  });
});

describe("CatalogService.setProductImages", () => {
  it("validates the list before touching the repository", () => {
    const setProductImages = vi.fn();
    const service = new CatalogService({ setProductImages } as unknown as ConstructorParameters<typeof CatalogService>[0]);

    expect(() => service.setProductImages("p1", { imageKeys: ["a", "b", "c", "d"] }, "staff-1")).toThrow();
    expect(setProductImages).not.toHaveBeenCalled();

    service.setProductImages("p1", { imageKeys: ["a", "b"] }, "staff-1");
    expect(setProductImages).toHaveBeenCalledWith("p1", ["a", "b"], "staff-1");
  });
});
