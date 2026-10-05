/**
 * Typed configuration, read once from the environment.
 *
 * We hand-parse rather than pull in a schema library — the surface is tiny and
 * a few helper coercions keep it honest without a dependency.
 */

// Load a local .env if present (Node 20.6+ built-in; no dotenv dependency).
try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(".env");
} catch {
  /* no .env — rely on the real environment / defaults */
}

const str = (key: string, fallback: string): string => process.env[key]?.trim() || fallback;

const int = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const list = (key: string): string[] =>
  (process.env[key] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const oneOf = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  const v = str(key, fallback) as T;
  return allowed.includes(v) ? v : fallback;
};

const llmProvider = oneOf("LLM_PROVIDER", ["mock", "anthropic", "ollama"] as const, "mock");
const anthropicKey = str("ANTHROPIC_API_KEY", "");

/** Resolve the effective provider: fall back to mock only when a choice can't run. */
const resolvedLlm =
  llmProvider === "anthropic" && anthropicKey
    ? "anthropic"
    : llmProvider === "ollama"
      ? "ollama"
      : "mock";

const upstreamBaseUrl = str("UPSTREAM_BASE_URL", "http://127.0.0.1:4000");
const portFromUrl = (() => {
  try {
    return Number(new URL(upstreamBaseUrl).port) || 4000;
  } catch {
    return 4000;
  }
})();

export const env = {
  port: int("PORT", 3000),
  logLevel: oneOf("LOG_LEVEL", ["debug", "info", "warn", "error"] as const, "info"),

  gateway: oneOf("GATEWAY", ["mock", "http"] as const, "mock"),
  upstreamBaseUrl,
  /** Port the standalone mock upstream server binds to (derived from the base URL). */
  mockUpstreamPortStandalone: portFromUrl,
  upstreamTimeoutMs: int("UPSTREAM_TIMEOUT_MS", 800),
  upstreamRetries: int("UPSTREAM_RETRIES", 2),
  cacheTtlMs: int("CACHE_TTL_MS", 60_000),
  /** TTL for cached LLM responses. 0 disables the response cache. */
  llmCacheTtlMs: int("LLM_CACHE_TTL_MS", 300_000),

  mockFailServices: list("MOCK_FAIL_SERVICES"),
  mockLatencyMs: int("MOCK_LATENCY_MS", 0),

  // If anthropic is requested but no key is present, fall back to mock so the
  // service always runs. This is the "runs with zero secrets" guarantee.
  llmProvider: resolvedLlm,
  anthropicKey,
  anthropicModel: str("ANTHROPIC_MODEL", "claude-sonnet-4-6"),

  ollamaBaseUrl: str("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
  ollamaModel: str("OLLAMA_MODEL", "llama3.2"),
} as const;

export type Env = typeof env;
