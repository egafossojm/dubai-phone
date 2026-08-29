import { z } from "zod";

export const listInventoryQuerySchema = z.object({
  q: z.string().trim().optional(),
  stock: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
  serialized: z.enum(["true", "false"]).optional(),
  brandId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listMovementsQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
  productSerialId: z.string().uuid().optional(),
  type: z
    .enum([
      "PURCHASE_RECEIPT",
      "SALE",
      "CUSTOMER_RETURN",
      "SUPPLIER_RETURN",
      "STOCK_ADJUSTMENT",
      "DAMAGED",
      "LOST",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listSerialsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z
    .enum([
      "IN_STOCK",
      "RESERVED",
      "SOLD",
      "RETURNED",
      "DAMAGED",
      "RETURNED_TO_SUPPLIER",
      "LOST",
    ])
    .optional(),
  variantId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const adjustStockSchema = z.object({
  variantId: z.string().uuid("Variante invalide."),
  quantity: z.coerce
    .number()
    .int("La quantité doit être un entier.")
    .refine((value) => value !== 0, "La quantité ne peut pas être zéro."),
  type: z.enum(["STOCK_ADJUSTMENT", "DAMAGED", "LOST"]).default("STOCK_ADJUSTMENT"),
  reason: z
    .string()
    .trim()
    .min(3, "Le motif est obligatoire (3 caractères minimum).")
    .max(500),
  productSerialId: z.string().uuid().optional(),
});
