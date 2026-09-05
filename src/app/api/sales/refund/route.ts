import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { AppError } from "@/lib/errors/app-error";

/**
 * Legacy stub — refunds go through /api/returns/[id]/refund.
 * Kept to avoid 404 for old clients; redirects with a clear error.
 */
export const POST = handleRoute(async (_request: NextRequest) => {
  await requirePermission("sales.refund");
  void _request;
  throw new AppError(
    "NOT_IMPLEMENTED",
    "Utilisez POST /api/returns/{id}/refund pour enregistrer un remboursement.",
  );
});
