import { createHash, randomBytes } from "node:crypto";

export { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/constants";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
