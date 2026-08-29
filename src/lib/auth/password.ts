import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  if (passwordHash.startsWith("$2a$") || passwordHash.startsWith("$2b$")) {
    return bcrypt.compare(plain, passwordHash);
  }
  return false;
}
