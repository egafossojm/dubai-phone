import { z } from "zod";

export const catalogNameSchema = z
  .string()
  .trim()
  .min(2, "Le nom doit contenir au moins 2 caractères.")
  .max(80, "Le nom est trop long.");

export const createBrandSchema = z.object({
  name: catalogNameSchema,
});

export const createCategorySchema = z.object({
  name: catalogNameSchema,
});

export const xafInputSchema = z.union([
  z.number().int("Le montant doit être un entier."),
  z
    .string()
    .trim()
    .regex(/^\d+$/, "Le montant doit être un entier en FCFA."),
]);

export const createVariantSchema = z.object({
  sku: z.string().trim().min(2).max(48),
  barcode: z.string().trim().max(64).optional().or(z.literal("")),
  name: z.string().trim().min(1, "Le nom de variante est requis.").max(80),
  sellingPriceXaf: xafInputSchema,
  costPriceXaf: xafInputSchema.default(0),
  warrantyMonths: z.coerce.number().int().min(0).max(120).default(0),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Le nom du produit est requis.").max(160),
  brandId: z.string().uuid("Marque invalide."),
  categoryId: z.string().uuid("Catégorie invalide."),
  isSerialized: z.boolean(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional(),
  variant: createVariantSchema,
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  brandId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  isSerialized: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional(),
});

export const updateVariantSchema = z.object({
  sku: z.string().trim().min(2).max(48).optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  sellingPriceXaf: xafInputSchema.optional(),
  costPriceXaf: xafInputSchema.optional(),
  warrantyMonths: z.coerce.number().int().min(0).max(120).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional(),
});

export const registerSerialSchema = z.object({
  variantId: z.string().uuid(),
  imei1: z.string().trim().optional().or(z.literal("")),
  imei2: z.string().trim().optional().or(z.literal("")),
  serialNumber: z.string().trim().optional().or(z.literal("")),
});

export const listProductsQuerySchema = z.object({
  q: z.string().trim().optional(),
  brandId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
  serialized: z.enum(["true", "false"]).optional(),
  stock: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
  sort: z.enum(["name", "recent", "price"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
