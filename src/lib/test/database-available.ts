import net from "node:net";

/**
 * Shared Postgres reachability check for integration suites.
 * In CI, a missing/unreachable database fails the run instead of skipping.
 */
export async function requireDatabaseForIntegration(): Promise<boolean> {
  const available = await isPostgresReachable();
  if (!available && process.env.CI === "true") {
    throw new Error(
      "DATABASE_URL is required in CI for integration tests (Postgres unreachable).",
    );
  }
  return available;
}

async function isPostgresReachable(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    await new Promise<void>((resolve, reject) => {
      const socket = net.connect({
        host: parsed.hostname || "127.0.0.1",
        port: Number(parsed.port || 5432),
      });
      socket.setTimeout(400);
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("timeout"));
      });
      socket.once("error", reject);
    });
    return true;
  } catch {
    return false;
  }
}
