import { describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";

describe("logger", () => {
  it("emits JSON lines on error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("probe_failure", { code: "X" });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0])) as {
      level: string;
      msg: string;
      code: string;
      service: string;
    };
    expect(payload.level).toBe("error");
    expect(payload.msg).toBe("probe_failure");
    expect(payload.code).toBe("X");
    expect(payload.service).toBe("dubai-phone");
    spy.mockRestore();
  });
});
