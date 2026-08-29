import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";

export function throwIfUniqueConflict(
  error: unknown,
  messages: Record<string, string>,
): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = Array.isArray(error.meta?.target)
      ? (error.meta.target as string[]).join(",")
      : String(error.meta?.target ?? "");

    for (const [field, message] of Object.entries(messages)) {
      if (target.includes(field)) {
        throw new AppError("CONFLICT", message);
      }
    }

    throw new AppError("CONFLICT", "Cette valeur existe déjà.");
  }

  throw error;
}
