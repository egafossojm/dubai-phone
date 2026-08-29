import { z } from "zod";

export const createCustomerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(8, "Le téléphone est requis.")
    .max(32),
  email: z
    .string()
    .trim()
    .email("E-mail invalide.")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(250).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomersQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
