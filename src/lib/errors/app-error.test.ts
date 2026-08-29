import { describe, expect, it } from "vitest";
import {
  AppError,
  isAppError,
  toUserMessage,
} from "@/lib/errors/app-error";

describe("AppError", () => {
  it("maps not-implemented errors to HTTP 501", () => {
    const error = new AppError(
      "NOT_IMPLEMENTED",
      "Cette opération n'est pas encore disponible.",
    );

    expect(error.statusCode).toBe(501);
    expect(error.code).toBe("NOT_IMPLEMENTED");
  });

  it("maps business rule errors to HTTP 422", () => {
    const error = new AppError(
      "BUSINESS_RULE_ERROR",
      "Remise non autorisée",
    );

    expect(error.statusCode).toBe(422);
    expect(error.code).toBe("BUSINESS_RULE_ERROR");
  });

  it("identifies AppError instances", () => {
    const error = new AppError("NOT_FOUND", "Ressource introuvable");
    expect(isAppError(error)).toBe(true);
    expect(isAppError(new Error("other"))).toBe(false);
  });

  it("returns a French fallback for unknown errors", () => {
    expect(toUserMessage(new Error("boom"))).toContain("erreur inattendue");
  });
});
