import { env } from "./env.js";

/**
 * A ~30-line structured logger over console — enough to avoid a logging
 * dependency while still emitting JSON lines a log aggregator can parse.
 *
 * `logger.child({ requestId })` returns a logger that stamps every line with
 * that context, which is how per-request correlation works without threading a
 * context object through every function.
 */
type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = ORDER[env.logLevel];
const pretty = process.stdout.isTTY;

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function emit(bindings: Record<string, unknown>, level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (ORDER[level] < threshold) return;
  const record = { time: new Date().toISOString(), level, msg, ...bindings, ...fields };
  if (pretty) {
    const { time, ...rest } = record;
    const extras = Object.entries(rest)
      .filter(([k]) => k !== "level" && k !== "msg")
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(" ");
    // eslint-disable-next-line no-console
    console.log(`${time} ${level.toUpperCase().padEnd(5)} ${msg}${extras ? "  " + extras : ""}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(record));
  }
}

function make(bindings: Record<string, unknown>): Logger {
  return {
    debug: (m, f) => emit(bindings, "debug", m, f),
    info: (m, f) => emit(bindings, "info", m, f),
    warn: (m, f) => emit(bindings, "warn", m, f),
    error: (m, f) => emit(bindings, "error", m, f),
    child: (extra) => make({ ...bindings, ...extra }),
  };
}

export const logger = make({ service: "context-engine" });
