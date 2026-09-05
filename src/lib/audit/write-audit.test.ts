/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { writeAudit } from "@/lib/audit/write-audit";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("writeAudit", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists an audit row with optional before/after payloads", async () => {
    const actor = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@dubai-phone.local" },
    });
    const entityId = `audit-test-${Date.now()}`;

    await writeAudit({
      actorId: actor.id,
      action: "qa.probe",
      entityType: "QaProbe",
      entityId,
      before: { status: "A" },
      after: { status: "B" },
      reason: "Prompt 015 QA",
    });

    const row = await prisma.auditLog.findFirstOrThrow({
      where: { entityId, action: "qa.probe" },
    });
    expect(row.actorId).toBe(actor.id);
    expect(row.entityType).toBe("QaProbe");
    expect(row.reason).toBe("Prompt 015 QA");
    expect(JSON.parse(row.beforeJson ?? "{}")).toEqual({ status: "A" });
    expect(JSON.parse(row.afterJson ?? "{}")).toEqual({ status: "B" });
  });
});
