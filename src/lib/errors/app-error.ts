export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE_ERROR"
  | "NOT_IMPLEMENTED"
  | "INFRASTRUCTURE_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { statusCode?: number; details?: unknown; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.statusCode = options?.statusCode ?? defaultStatusCode(code);
    this.details = options?.details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

function defaultStatusCode(code: AppErrorCode): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "AUTHENTICATION_ERROR":
      return 401;
    case "AUTHORIZATION_ERROR":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "BUSINESS_RULE_ERROR":
      return 422;
    case "NOT_IMPLEMENTED":
      return 501;
    case "INFRASTRUCTURE_ERROR":
      return 503;
    default:
      return 500;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toUserMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  return "Une erreur inattendue s'est produite. Veuillez réessayer.";
}
