import { AppError } from "@/lib/errors/app-error";

/** Normalize Cameroon-style phone for storage / uniqueness. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "").trim();
  if (digits.length < 8) {
    throw new AppError("VALIDATION_ERROR", "Numéro de téléphone invalide.");
  }
  return digits;
}

export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
