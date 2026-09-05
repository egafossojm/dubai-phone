import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { fail, ok } from "@/lib/api/response";
import { logger } from "@/lib/logger";

type MigrationRow = { present: number };

/**
 * Readiness probe — Postgres answers AND at least one finished Prisma migration.
 * Empty / unmigrated databases return 503 (not "ready for traffic").
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const migrations = await prisma.$queryRaw<MigrationRow[]>`
      SELECT 1::int AS present
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL
      LIMIT 1
    `;
    if (!migrations.length) {
      logger.warn("readiness_schema_missing", { reason: "no_finished_migrations" });
      return NextResponse.json(
        fail({
          code: "INFRASTRUCTURE_ERROR",
          message: "Schéma base de données non migré.",
        }),
        { status: 503 },
      );
    }
    return NextResponse.json(
      ok({
        status: "ready",
        service: "dubai-phone",
        probe: "ready",
        database: "up",
        schema: "migrated",
        timestamp,
      }),
    );
  } catch (error) {
    logger.error("readiness_check_failed", {
      err: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      fail({
        code: "INFRASTRUCTURE_ERROR",
        message: "Base de données indisponible.",
      }),
      { status: 503 },
    );
  }
}
