import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

type WriteAuditInput = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  tx?: Prisma.TransactionClient;
};

export async function writeAudit(input: WriteAuditInput): Promise<void> {
  const client = input.tx ?? prisma;
  await client.auditLog.create({
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
