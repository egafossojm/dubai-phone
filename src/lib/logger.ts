import { env } from "@/lib/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type LogFields = Record<string, unknown>;

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[env.LOG_LEVEL];
}

function write(level: LogLevel, msg: string, fields?: LogFields) {
  if (!shouldLog(level)) {
    return;
  }
  const line = JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    service: "dubai-phone",
    ...(fields ?? {}),
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => write("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => write("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => write("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => write("error", msg, fields),
};
