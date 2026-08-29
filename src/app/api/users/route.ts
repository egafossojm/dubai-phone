import { prisma } from "@/lib/db/prisma";
import { protectedGet, protectedPost } from "@/lib/auth/permission-route";

export const GET = protectedGet("users.read", async () => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
    },
  });
  return { users };
});

export const POST = protectedPost("users.create");
