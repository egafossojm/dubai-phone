import { z } from "zod";
import { xafInputSchema } from "@/modules/products/api/schemas";

export const listCreditsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z
    .enum([
      "PENDING",
      "ACTIVE",
      "PARTIALLY_PAID",
      "OVERDUE",
      "PAID",
      "DEFAULTED",
      "CANCELLED",
    ])
    .optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const registerCreditPaymentSchema = z.object({
  creditId: z.string().uuid(),
  installmentId: z.string().uuid().optional(),
  amountXaf: xafInputSchema,
  method: z.enum(["CASH", "ORANGE_MONEY", "MTN_MOBILE_MONEY"]),
  operatorReference: z.string().trim().max(80).optional().or(z.literal("")),
  idempotencyKey: z.string().trim().min(8).max(120),
});
