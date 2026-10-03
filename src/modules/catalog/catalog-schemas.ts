import { z } from "zod";

export const optionValueInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  priceDeltaCents: z.number().int().min(0),
  available: z.boolean(),
});

export const optionGroupInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    required: z.boolean(),
    minSelections: z.number().int().min(0),
    maxSelections: z.number().int().min(1),
    values: z.array(optionValueInputSchema).min(1),
  })
  .superRefine((group, context) => {
    if (group.minSelections > group.maxSelections) {
      context.addIssue({
        code: "custom",
        path: ["minSelections"],
        message: "minSelections no puede ser mayor que maxSelections",
      });
    }
    if (group.required && group.minSelections < 1) {
      context.addIssue({
        code: "custom",
        path: ["minSelections"],
        message: "Los grupos obligatorios deben requerir al menos una selección",
      });
    }
    if (group.minSelections > group.values.length) {
      context.addIssue({
        code: "custom",
        path: ["minSelections"],
        message: "minSelections no puede superar la cantidad de valores",
      });
    }
  });

export const catalogProductInputSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600),
  priceCents: z.number().int().min(0).max(2_000_000_000),
  available: z.boolean(),
  // Null means unlimited. Defaults to null so existing callers stay valid.
  stockQuantity: z.number().int().min(0).max(100_000).nullable().default(null),
  visible: z.boolean(),
  featured: z.boolean().default(false),
  station: z.enum(["GENERAL", "KITCHEN", "BAR"]),
  fulfillment: z.enum(["TABLE", "PICKUP"]),
  sortOrder: z.number().int().min(0),
  optionGroups: z.array(optionGroupInputSchema),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).default(0),
  visible: z.boolean().default(true),
});

export const categoryOrderInputSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1),
});

export const availabilityInputSchema = z.object({ available: z.boolean() }).strict();
export const productImageInputSchema = z.object({ imageKey: z.string().nullable() }).strict();
export const tableInputSchema = z.object({ label: z.string().trim().min(1).max(60) });

export type CatalogProductInput = z.infer<typeof catalogProductInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
