/**
 * Next.js instrumentation — fail-fast env validation on Node server boot.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
