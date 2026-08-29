import type { AuthUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";
import {
  jsonOk,
  requirePermission,
  toErrorResponse,
} from "@/lib/auth/http";
import type { PermissionCode } from "@/lib/auth/permissions";

export function protectedGet(
  permission: PermissionCode,
  loader?: (user: AuthUser) => Promise<unknown>,
) {
  return async function GET() {
    try {
      const user = await requirePermission(permission);
      const data = loader ? await loader(user) : { permitted: true };
      return jsonOk(data);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function protectedPost(permission: PermissionCode) {
  return async function POST() {
    try {
      await requirePermission(permission);
      throw new AppError(
        "NOT_IMPLEMENTED",
        "Cette opération n'est pas encore disponible.",
      );
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
