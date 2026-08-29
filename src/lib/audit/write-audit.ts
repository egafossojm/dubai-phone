import { prisma } from "@/lib/db/prisma";

type WriteAuditInput = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

export async function writeAudit(input: WriteAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: input.before ? JSON.stringify(input.before) : undefined,
      afterJson: input.after ? JSON.stringify(input.after) : undefined,
      reason: input.reason,
    },
  });
}
