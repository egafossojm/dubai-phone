import { NextResponse } from "next/server";
import { AppError, isAppError } from "@/lib/errors/app-error";
import { fail, ok } from "@/lib/api/response";
import {
  getCurrentUser,
  type AuthUser,
} from "@/lib/auth/session";
import {
  hasPermission,
  type PermissionCode,
} from "@/lib/auth/permissions";
import { logger } from "@/lib/logger";

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

export function jsonOk<T>(data: T, status = 200) {
  const payload = JSON.parse(JSON.stringify(ok(data), jsonReplacer)) as ReturnType<
    typeof ok<T>
  >;
  return NextResponse.json(payload, { status });
}

export function jsonFail(error: AppError) {
  return NextResponse.json(fail(error), { status: error.statusCode });
}

export function toErrorResponse(error: unknown) {
  if (isAppError(error)) {
    return jsonFail(error);
  }
  logger.error("unhandled_api_error", {
    err: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : undefined,
  });
  return jsonFail(
    new AppError(
      "INTERNAL_ERROR",
      "Une erreur inattendue s'est produite. Veuillez réessayer.",
    ),
  );
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("AUTHENTICATION_ERROR", "Session expirée. Veuillez vous reconnecter.");
  }
  return user;
}

export async function requirePermission(permission: PermissionCode): Promise<AuthUser> {
  const user = await requireUser();
  if (!hasPermission(user.permissions, permission)) {
    throw new AppError("AUTHORIZATION_ERROR", "Action non autorisée.");
  }
  return user;
}
