import { z } from "zod";
import { xafInputSchema } from "@/modules/products/api/schemas";

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("E-mail invalide.")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(250).optional().or(z.literal("")),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const listSuppliersQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const purchaseOrderItemInputSchema = z.object({
  variantId: z.string().uuid(),
  quantityOrdered: z.coerce.number().int().min(1).max(100_000),
  unitCostXaf: xafInputSchema,
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  items: z.array(purchaseOrderItemInputSchema).min(1, "Ajoutez au moins une ligne."),
  submit: z.boolean().optional().default(false),
});

export const updatePurchaseOrderSchema = z.object({
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  items: z.array(purchaseOrderItemInputSchema).min(1).optional(),
});

export const listPurchaseOrdersQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z
    .enum([
      "DRAFT",
      "ORDERED",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      "CANCELLED",
      "CLOSED",
    ])
    .optional(),
  supplierId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const receiveSerialSchema = z.object({
  imei1: z.string().trim().optional().or(z.literal("")),
  imei2: z.string().trim().optional().or(z.literal("")),
  serialNumber: z.string().trim().optional().or(z.literal("")),
  condition: z.enum(["NEW", "DAMAGED"]).optional().default("NEW"),
});

export const receiveLineSchema = z.object({
  purchaseOrderItemId: z.string().uuid(),
  quantityReceived: z.coerce.number().int().min(1),
  unitCostXaf: xafInputSchema.optional(),
  serials: z.array(receiveSerialSchema).optional(),
});

export const receivePurchaseSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(120),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  lines: z.array(receiveLineSchema).min(1),
});

export const listInvoicesQuerySchema = z.object({
  q: z.string().trim().optional(),
  supplierId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
