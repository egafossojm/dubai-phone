/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import { GET as live } from "@/app/api/health/route";
import { GET as ready } from "@/app/api/ready/route";

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("health probes", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns liveness without requiring auth", async () => {
    const response = await live();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { probe: string; status: string };
    };
    expect(payload.data.probe).toBe("live");
    expect(payload.data.status).toBe("ok");
  });

  it("returns readiness when Postgres answers", async () => {
    const response = await ready();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { probe: string; database: string; schema: string };
    };
    expect(payload.data.probe).toBe("ready");
    expect(payload.data.database).toBe("up");
    expect(payload.data.schema).toBe("migrated");
  });
});
