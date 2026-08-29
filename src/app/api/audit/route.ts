import { prisma } from "@/lib/db/prisma";
import { protectedGet } from "@/lib/auth/permission-route";

export const GET = protectedGet("audit.read", async () => {
  const logs = await prisma.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      entityType: true,
      createdAt: true,
    },
  });
  return { logs };
});
