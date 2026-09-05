import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import { dashboardQuerySchema } from "@/modules/dashboard/api/schemas";
import { getDashboardUseCase } from "@/modules/dashboard/application/dashboard";

export const GET = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("dashboard.read");
  const parsed = dashboardQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Filtres tableau de bord invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await getDashboardUseCase(user, parsed.data));
});
