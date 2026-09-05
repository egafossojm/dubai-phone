import { z } from "zod";

const logLevelSchema = z.enum(["debug", "info", "warn", "error"]).default("info");

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_APP_NAME: z.string().default("Dubai Phone"),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    LOG_LEVEL: logLevelSchema,
    TRUSTED_PROXY: z
      .enum(["0", "1", "true", "false"])
      .optional()
      .transform((value) => value === "1" || value === "true"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && !data.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required when NODE_ENV=production",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Pure parse helper (unit-testable without reloading the module). */
export function parseEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const parsed = envSchema.safeParse({
    NODE_ENV: source.NODE_ENV,
    DATABASE_URL: source.DATABASE_URL || undefined,
    NEXT_PUBLIC_APP_NAME: source.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL,
    LOG_LEVEL: source.LOG_LEVEL,
    TRUSTED_PROXY: source.TRUSTED_PROXY || undefined,
  });

  if (!parsed.success) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "invalid_environment",
        time: new Date().toISOString(),
        fields: parsed.error.flatten().fieldErrors,
      }),
    );
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

/**
 * Whether reverse-proxy IP headers may be trusted.
 * Reads process.env at call time so tests can toggle TRUSTED_PROXY;
 * boot still validates the value shape via {@link parseEnv} / {@link env}.
 */
export function isTrustedProxyEnabled(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return source.TRUSTED_PROXY === "1" || source.TRUSTED_PROXY === "true";
}

/**
 * Validated environment configuration.
 * DATABASE_URL is optional in development/test so the UI shell can start
 * without a live DB; it is required in production.
 */
export const env = parseEnv();
