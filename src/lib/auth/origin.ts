import { AppError } from "@/lib/errors/app-error";

/**
 * Soft CSRF defense for cookie-authenticated mutating requests.
 * When Origin is present, it must match NEXT_PUBLIC_APP_URL.
 * Missing Origin (same-site navigations, curl, some clients) is allowed —
 * SameSite=Lax remains the primary CSRF control.
 */
export function assertMutatingOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    return;
  }

  try {
    const expected = new URL(appUrl).origin;
    const actual = new URL(origin).origin;
    if (expected !== actual) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Origine de la requête non autorisée.",
        { statusCode: 403 },
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      "AUTHENTICATION_ERROR",
      "Origine de la requête invalide.",
      { statusCode: 403 },
    );
  }
}
