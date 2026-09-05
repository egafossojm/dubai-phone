import { z } from "zod";
import { xafInputSchema } from "@/modules/products/api/schemas";

export const listReturnsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z
    .enum(["REQUESTED", "INSPECTING", "ACCEPTED", "REJECTED", "COMPLETED"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const returnItemInputSchema = z.object({
  saleItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(10_000),
  productSerialId: z.string().uuid().optional(),
  /** Restock is decided at accept by sales.refund — ignored on create. */
});

export const createReturnSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  items: z.array(returnItemInputSchema).min(1).max(50),
});

export const acceptReturnItemSchema = z.object({
  returnItemId: z.string().uuid(),
  restock: z.boolean(),
});

export const acceptReturnSchema = z.object({
  resolution: z.enum(["REFUND", "EXCHANGE"]),
  items: z.array(acceptReturnItemSchema).max(50).optional(),
});

export const rejectReturnSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

export const completeRefundSchema = z.object({
  amountXaf: xafInputSchema,
  method: z.enum(["CASH", "ORANGE_MONEY", "MTN_MOBILE_MONEY"]),
  idempotencyKey: z.string().trim().min(8).max(120),
  operatorReference: z.string().trim().max(80).optional().or(z.literal("")),
});

export const exchangeItemSchema = z.object({
  returnItemId: z.string().uuid(),
  /** Replacement serial for serialized products; omit for non-serialized same-SKU. */
  replacementProductSerialId: z.string().uuid().optional(),
});

export const completeExchangeSchema = z.object({
  items: z.array(exchangeItemSchema).min(1).max(50),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const warrantyLookupQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
});
