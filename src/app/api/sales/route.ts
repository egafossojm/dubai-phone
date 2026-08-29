import { prisma } from "@/lib/db/prisma";
import { protectedGet, protectedPost } from "@/lib/auth/permission-route";

export const GET = protectedGet("sales.read", async () => {
  const sales = await prisma.sale.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      status: true,
      totalXaf: true,
      completedAt: true,
    },
  });
  return { sales };
});

export const POST = protectedPost("sales.create");
