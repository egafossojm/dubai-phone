import { z } from "zod";
import {
  DASHBOARD_CUSTOM_MAX_DAYS,
  inclusiveDaySpan,
} from "@/modules/dashboard/domain/policies";

export const dashboardPeriodSchema = z.enum([
  "today",
  "week",
  "month",
  "custom",
]);

export const dashboardQuerySchema = z
  .object({
    period: dashboardPeriodSchema.default("today"),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.period !== "custom") {
      return;
    }
    if (!value.from || !value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Période personnalisée : from et to (YYYY-MM-DD) requis.",
        path: ["from"],
      });
      return;
    }
    if (value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La date de début doit précéder la date de fin.",
        path: ["from"],
      });
      return;
    }
    const span = inclusiveDaySpan(value.from, value.to);
    if (span > DASHBOARD_CUSTOM_MAX_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Période trop longue (max ${DASHBOARD_CUSTOM_MAX_DAYS} jours).`,
        path: ["to"],
      });
    }
  });
