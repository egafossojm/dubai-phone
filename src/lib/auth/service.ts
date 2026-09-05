import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { verifyPassword } from "@/lib/auth/password";
import {
  isLoginRateLimited,
  recordLoginFailure,
  resetLoginRateLimit,
} from "@/lib/auth/rate-limit";
import {
  clearSessionCookie,
  createUserSession,
  revokeSessionByToken,
  setSessionCookie,
} from "@/lib/auth/session";
import {
  SESSION_COOKIE,
  hashSessionToken,
} from "@/lib/auth/session-token";
import { cookies } from "next/headers";

const loginSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

/**
 * Resolve client IP for rate-limit / audit.
 * Only trust X-Forwarded-For / X-Real-IP when TRUSTED_PROXY=1 (reverse proxy).
 */
export function clientIp(request: Request): string {
  const trusted =
    process.env.TRUSTED_PROXY === "1" ||
    process.env.TRUSTED_PROXY === "true";
  if (!trusted) {
    return "unknown";
  }
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function login(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Identifiants invalides.", {
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const email = parsed.data.email.toLowerCase();
  const ip = clientIp(request);

  if (isLoginRateLimited(ip, email)) {
    throw new AppError(
      "AUTHENTICATION_ERROR",
      "Trop de tentatives. Réessayez dans quelques minutes.",
      { statusCode: 429 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  const passwordOk =
    user && !user.deletedAt
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : false;

  if (!user || user.status !== "ACTIVE" || !passwordOk) {
    recordLoginFailure(ip, email);
    await prisma.auditLog.create({
      data: {
        actorId: user?.id,
        action: "auth.login_failed",
        entityType: "User",
        entityId: user?.id ?? email,
        ipAddress: ip,
        reason: "invalid_credentials_or_disabled",
      },
    });
    throw new AppError("AUTHENTICATION_ERROR", "E-mail ou mot de passe incorrect.");
  }

  resetLoginRateLimit(ip, email);
  const token = await createUserSession(user.id);
  await setSessionCookie(token);

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      ipAddress: ip,
    },
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
  };
}

export async function logout(request: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const ip = clientIp(request);
  let actorId: string | undefined;
  let sessionId = "none";

  if (token) {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (session && !session.revokedAt) {
      actorId = session.userId;
      sessionId = session.id;
    }
    await revokeSessionByToken(token);
  }
  await clearSessionCookie();

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "auth.logout",
      entityType: "Session",
      entityId: sessionId,
      ipAddress: ip,
    },
  });
}

export { hashPassword } from "@/lib/auth/password";
