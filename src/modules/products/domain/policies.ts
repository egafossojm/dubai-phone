import { AppError } from "@/lib/errors/app-error";
import { xaf, type Xaf } from "@/lib/money";

const IMEI_PATTERN = /^\d{14,16}$/;
const SERIAL_PATTERN = /^[A-Za-z0-9-]{4,40}$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,47}$/;

export function normalizeSku(value: string): string {
  const sku = value.trim().toUpperCase();
  if (!SKU_PATTERN.test(sku)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Le SKU doit contenir 2 à 48 caractères (lettres, chiffres, tiret, point).",
    );
  }
  return sku;
}

export function parseXafAmount(value: unknown, label: string, minimum = 0): Xaf {
  try {
    const amount = xaf(value as number | string | bigint);
    if (amount < BigInt(minimum)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `${label} doit être un entier ≥ ${minimum} FCFA.`,
      );
    }
    return amount;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      "VALIDATION_ERROR",
      `${label} doit être un montant entier en FCFA.`,
    );
  }
}

export function assertSellingPrice(selling: Xaf, cost: Xaf): void {
  if (selling <= BigInt(0)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Le prix de vente TTC doit être supérieur à 0 FCFA.",
    );
  }
  if (cost < BigInt(0)) {
    throw new AppError("VALIDATION_ERROR", "Le coût d'achat ne peut pas être négatif.");
  }
}

export function normalizeOptionalImei(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const imei = value.trim();
  if (!imei) {
    return null;
  }
  if (!IMEI_PATTERN.test(imei)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "L'IMEI doit contenir 14 à 16 chiffres.",
    );
  }
  return imei;
}

export function normalizeOptionalSerial(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  const serial = value.trim().toUpperCase();
  if (!serial) {
    return null;
  }
  if (!SERIAL_PATTERN.test(serial)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Le numéro de série doit contenir 4 à 40 caractères alphanumériques.",
    );
  }
  return serial;
}

export function assertSerializedIdentifiers(input: {
  imei1: string | null;
  imei2: string | null;
  serialNumber: string | null;
}): void {
  if (!input.imei1 && !input.serialNumber) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Indiquez au moins l'IMEI 1 ou le numéro de série.",
    );
  }
  if (input.imei1 && input.imei2 && input.imei1 === input.imei2) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "IMEI 1 et IMEI 2 doivent être différents.",
    );
  }
}

export function assertCanRegisterSerial(isSerialized: boolean): void {
  if (!isSerialized) {
    throw new AppError(
      "BUSINESS_RULE_ERROR",
      "Les IMEI / numéros de série ne s'appliquent qu'aux produits sérialisés.",
    );
  }
}

export function assertSerialsAreRecordedAtReceipt(): never {
  throw new AppError(
    "BUSINESS_RULE_ERROR",
    "Les IMEI et numéros de série s'enregistrent à la réception de stock, pas dans le catalogue.",
  );
}

export function stockStatusFromQuantity(
  quantity: number,
  lowThreshold: number,
): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" {
  if (quantity <= 0) {
    return "OUT_OF_STOCK";
  }
  if (quantity <= lowThreshold) {
    return "LOW_STOCK";
  }
  return "IN_STOCK";
}

export function stockStatusLabel(
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK",
): string {
  switch (status) {
    case "LOW_STOCK":
      return "Stock faible";
    case "OUT_OF_STOCK":
      return "Rupture";
    default:
      return "En stock";
  }
}

export function productStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Actif";
    case "INACTIVE":
      return "Inactif";
    case "DRAFT":
      return "Brouillon";
    default:
      return status;
  }
}

export function deviceStatusLabel(status: string): string {
  switch (status) {
    case "IN_STOCK":
      return "En stock";
    case "RESERVED":
      return "Réservé";
    case "SOLD":
      return "Vendu";
    case "RETURNED":
      return "Retourné";
    case "DAMAGED":
      return "Endommagé";
    case "RETURNED_TO_SUPPLIER":
      return "Retour fournisseur";
    case "LOST":
      return "Perdu";
    default:
      return status;
  }
}

export function canSeeCostPrice(permissions: readonly string[]): boolean {
  return (
    permissions.includes("products.create") ||
    permissions.includes("products.update") ||
    permissions.includes("purchases.read")
  );
}

/** Price changes restricted to roles with products.delete (SA / Manager). */
export function canChangeProductPrices(permissions: readonly string[]): boolean {
  return permissions.includes("products.delete");
}
