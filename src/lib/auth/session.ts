import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  hashSessionToken,
} from "@/lib/auth/session-token";
import type { PermissionCode } from "@/lib/auth/permissions";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: PermissionCode[];
};

export async function createUserSession(userId: string): Promise<string> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const tokenHash = hashSessionToken(token);

  await prisma.$transaction([
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return token;
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return getUserFromSessionToken(token);
}

export async function getUserFromSessionToken(
  token: string,
): Promise<AuthUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  if (session.user.status !== "ACTIVE" || session.user.deletedAt) {
    return null;
  }

  const roles = session.user.roles.map((item) => item.role.code);
  const permissions = [
    ...new Set(
      session.user.roles.flatMap((item) =>
        item.role.permissions.map((entry) => entry.permission.code),
      ),
    ),
  ] as PermissionCode[];

  return {
    id: session.user.id,
    email: session.user.email,
    fullName: session.user.fullName,
    roles,
    permissions,
  };
}
