/**
 * Money helpers — FCFA stored as integer BigInt (ADR-0004).
 * Never use floating point for financial amounts.
 */
export type Xaf = bigint;

export function xaf(amount: number | string | bigint): Xaf {
  if (typeof amount === "bigint") {
    return amount;
  }
  if (typeof amount === "number") {
    if (!Number.isInteger(amount) || !Number.isSafeInteger(amount)) {
      throw new Error("FCFA amounts must be whole safe integers");
    }
    return BigInt(amount);
  }
  if (!/^-?\d+$/.test(amount)) {
    throw new Error("Invalid FCFA amount");
  }
  return BigInt(amount);
}

export function addXaf(...parts: Xaf[]): Xaf {
  return parts.reduce((sum, part) => sum + part, BigInt(0));
}

export function formatXaf(amount: Xaf): string {
  const sign = amount < BigInt(0) ? "-" : "";
  const absolute = amount < BigInt(0) ? -amount : amount;
  const grouped = absolute.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${sign}${grouped} FCFA`;
}

/**
 * Strip grouping spaces/separators from user input (e.g. "8 000" → "8000").
 * parseInt("8 000") === 8 — never use parseInt on localized amounts.
 */
export function normalizeMoneyInput(value: string | number | bigint): string {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return "0";
    }
    return String(value);
  }
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : "0";
}
