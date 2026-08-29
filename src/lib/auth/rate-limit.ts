/**
 * Login brute-force limiter (MVP).
 *
 * In-memory only: resets on process restart and does not share across instances.
 * See ADR-0008. Production: replace with Redis (or equivalent) and take the client
 * IP from the trusted reverse-proxy hop — never trust raw `X-Forwarded-For`
 * from the internet.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const buckets = new Map<string, Bucket>();

function keyFor(ip: string, email: string): string {
  return `${ip}|${email.trim().toLowerCase()}`;
}

function currentBucket(ip: string, email: string, now: number): Bucket | undefined {
  const key = keyFor(ip, email);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (current) {
      buckets.delete(key);
    }
    return undefined;
  }
  return current;
}

/** True when this IP+email pair already has too many failed attempts. */
export function isLoginRateLimited(ip: string, email: string): boolean {
  const current = currentBucket(ip, email, Date.now());
  return Boolean(current && current.count >= MAX_ATTEMPTS);
}

/** Count a failed login only (successful logins must call `resetLoginRateLimit`). */
export function recordLoginFailure(ip: string, email: string): void {
  const key = keyFor(ip, email);
  const now = Date.now();
  const current = currentBucket(ip, email, now);

  if (!current) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  current.count += 1;
}

export function resetLoginRateLimit(ip: string, email: string): void {
  buckets.delete(keyFor(ip, email));
}

export function resetLoginRateLimitForTests(): void {
  buckets.clear();
}

export const LOGIN_RATE_LIMIT = {
  windowMs: WINDOW_MS,
  maxAttempts: MAX_ATTEMPTS,
};
