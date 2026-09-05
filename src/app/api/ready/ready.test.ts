/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.hoisted(() => vi.fn());
const loggerWarn = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRaw,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerError,
    warn: loggerWarn,
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("GET /api/ready", () => {
  beforeEach(() => {
    queryRaw.mockReset();
    loggerWarn.mockReset();
    loggerError.mockReset();
    vi.resetModules();
  });

  it("returns 503 when the database query fails", async () => {
    queryRaw.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { GET } = await import("@/app/api/ready/route");
    const response = await GET();
    expect(response.status).toBe(503);
    const payload = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("INFRASTRUCTURE_ERROR");
    expect(loggerError).toHaveBeenCalled();
  });

  it("returns 503 when Postgres is up but no migrations finished", async () => {
    queryRaw
      .mockResolvedValueOnce([{ "?column?": 1 }])
      .mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/ready/route");
    const response = await GET();
    expect(response.status).toBe(503);
    const payload = (await response.json()) as {
      error: { message: string };
    };
    expect(payload.error.message).toMatch(/migré/i);
    expect(loggerWarn).toHaveBeenCalled();
  });

  it("returns 200 when database is up and migrations exist", async () => {
    queryRaw
      .mockResolvedValueOnce([{ "?column?": 1 }])
      .mockResolvedValueOnce([{ present: 1 }]);
    const { GET } = await import("@/app/api/ready/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { schema: string; database: string };
    };
    expect(payload.data.database).toBe("up");
    expect(payload.data.schema).toBe("migrated");
  });
});
