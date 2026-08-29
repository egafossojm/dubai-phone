import { z } from "zod";
import { xafInputSchema } from "@/modules/products/api/schemas";

export const salePaymentSchema = z
  .object({
    method: z.enum(["CASH", "ORANGE_MONEY", "MTN_MOBILE_MONEY"]),
    amountXaf: xafInputSchema,
    idempotencyKey: z.string().trim().min(8).max(120),
    operatorReference: z.string().trim().max(80).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.method !== "CASH") {
      const ref = value.operatorReference?.trim() ?? "";
      if (ref.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "La référence opérateur est obligatoire pour Orange Money / MTN MoMo.",
          path: ["operatorReference"],
        });
      }
    }
  });

export const saleItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(10_000),
  productSerialId: z.string().uuid().optional(),
  /** Remise fixe ligne en FCFA (optionnel). */
  discountXaf: xafInputSchema.optional().default(0),
});

export const installmentPlanSchema = z.object({
  installmentCount: z.coerce.number().int().min(1).max(24),
  firstDueDate: z.string().trim().min(8).max(40).optional(),
  intervalDays: z.coerce.number().int().min(7).max(90).default(30),
});

export const completeSaleSchema = z.object({
  clientTxnId: z.string().uuid(),
  kind: z.enum(["IMMEDIATE", "INSTALLMENT"]),
  customerId: z.string().uuid().optional().nullable(),
  items: z.array(saleItemSchema).min(1).max(50),
  /** Remise globale fixe en FCFA. */
  discountTotalXaf: xafInputSchema.optional().default(0),
  payments: z.array(salePaymentSchema).min(1).max(10),
  installmentPlan: installmentPlanSchema.optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const posCatalogQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(30).default(15),
});
