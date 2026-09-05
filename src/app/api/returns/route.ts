import { NextRequest } from "next/server";
import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";
import {
  createReturnSchema,
  listReturnsQuerySchema,
} from "@/modules/returns/api/schemas";
import {
  createReturnUseCase,
  listReturnsUseCase,
} from "@/modules/returns/application/returns";

export const GET = handleRoute(async (request: NextRequest) => {
  await requirePermission("sales.read");
  const parsed = listReturnsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Filtres invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await listReturnsUseCase(parsed.data));
});

export const POST = handleRoute(async (request: NextRequest) => {
  const user = await requirePermission("sales.create");
  const body = await request.json().catch(() => null);
  const parsed = createReturnSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Données de retour invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }
  return jsonOk(await createReturnUseCase(user, parsed.data), 201);
});
