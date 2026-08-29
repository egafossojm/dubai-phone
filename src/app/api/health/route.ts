import { NextResponse } from "next/server";
import { ok } from "@/lib/api/response";

export async function GET() {
  return NextResponse.json(
    ok({
      status: "ok",
      service: "dubai-phone",
      timestamp: new Date().toISOString(),
    }),
  );
}
