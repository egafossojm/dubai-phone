import { NextResponse } from "next/server";
import { ok } from "@/lib/api/response";

/**
 * Liveness probe — process is up. Does not touch the database.
 * Use `/api/ready` for dependency readiness (Postgres).
 */
export async function GET() {
  return NextResponse.json(
    ok({
      status: "ok",
      service: "dubai-phone",
      probe: "live",
      timestamp: new Date().toISOString(),
    }),
  );
}
