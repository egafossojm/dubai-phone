/**
 * Login brute-force limiter (MVP).
 *
 * Primary bucket: email (prevents X-Forwarded-For rotation bypass).
 * Secondary bucket: client IP (caps spray across many emails from one host).
 *
 * In-memory only: resets on process restart and does not share across instances.
 * See ADR-0008 / ADR-0009. Production: Redis + TRUSTED_PROXY=1 behind a real proxy.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
/** Failed attempts per email before lockout. */
const MAX_ATTEMPTS_EMAIL = 5;
/** Failed attempts per IP before lockout (shared NAT tolerant). */
const MAX_ATTEMPTS_IP = 30;

const buckets = new Map<string, Bucket>();

function emailKey(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}

function ipKey(ip: string): string {
  return `ip:${ip.trim().toLowerCase() || "unknown"}`;
}

function readBucket(key: string, now: number): Bucket | undefined {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (current) {
      buckets.delete(key);
    }
    return undefined;
  }
  return current;
}

function bump(key: string, now: number): void {
  const current = readBucket(key, now);
  if (!current) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
}

function isLimited(key: string, max: number, now: number): boolean {
  const current = readBucket(key, now);
  return Boolean(current && current.count >= max);
}

/** Count a failed login only (successful logins must call `resetLoginRateLimit`). */
export function recordLoginFailure(ip: string, email: string): void {
  const now = Date.now();
  bump(emailKey(email), now);
  // Skip shared "unknown" IP bucket (no TRUSTED_PROXY) to avoid node-wide lockout.
  if (ip.trim().toLowerCase() !== "unknown") {
    bump(ipKey(ip), now);
  }
}

/** True when email or (trusted) IP already has too many failed attempts. */
export function isLoginRateLimited(ip: string, email: string): boolean {
  const now = Date.now();
  if (isLimited(emailKey(email), MAX_ATTEMPTS_EMAIL, now)) {
    return true;
  }
  if (ip.trim().toLowerCase() === "unknown") {
    return false;
  }
  return isLimited(ipKey(ip), MAX_ATTEMPTS_IP, now);
}

export function resetLoginRateLimit(ip: string, email: string): void {
  buckets.delete(emailKey(email));
  buckets.delete(ipKey(ip));
}

export function resetLoginRateLimitForTests(): void {
  buckets.clear();
}

export const LOGIN_RATE_LIMIT = {
  windowMs: WINDOW_MS,
  maxAttempts: MAX_ATTEMPTS_EMAIL,
  maxAttemptsPerIp: MAX_ATTEMPTS_IP,
};
