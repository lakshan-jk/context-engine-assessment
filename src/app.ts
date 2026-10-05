import Fastify, { type FastifyInstance } from "fastify";
import { env } from "./infra/env.js";
import { logger } from "./infra/logger.js";
import { InMemoryCache } from "./infra/cache.js";
import { ResilientGateway, type ServiceGateway } from "./gateway/gateway.js";
import { MockGateway } from "./gateway/mock-gateway.js";
import { HttpGateway } from "./gateway/http-gateway.js";
import { MockLlmProvider } from "./llm/mock-provider.js";
import { AnthropicLlmProvider } from "./llm/anthropic-provider.js";
import { OllamaLlmProvider } from "./llm/ollama-provider.js";
import { CachingLlmProvider } from "./llm/caching-provider.js";
import type { LlmProvider } from "./llm/provider.js";
import { ContextEngine } from "./pipeline.js";
import { InMemoryMemoryStore } from "./engine/memory.js";
import { registerRoutes } from "./routes/routes.js";

/**
 * The COMPOSITION ROOT — the single place where concrete implementations are
 * chosen and wired. Nothing downstream knows whether the gateway is mock or
 * http, or which LLM is in use; that decision lives here and here only.
 */
export function buildApp(): FastifyInstance {
  const cache = new InMemoryCache();

  // Pick the upstream adapter, then wrap it once with the shared resilience
  // policy (cache + retry + timeout). Same decorator over either adapter.
  const baseGateway: ServiceGateway =
    env.gateway === "http" ? new HttpGateway(env.upstreamBaseUrl) : new MockGateway({
      failServices: env.mockFailServices,
      latencyMs: env.mockLatencyMs,
    });

  const gateway = new ResilientGateway(baseGateway, cache, {
    timeoutMs: env.upstreamTimeoutMs,
    retries: env.upstreamRetries,
    cacheTtlMs: env.cacheTtlMs,
  }, logger);

  // Wrap the chosen LLM with a response cache (skip if TTL is 0). Same decorator
  // idea as ResilientGateway — the expensive per-token call is cached by prompt.
  const llm: LlmProvider =
    env.llmCacheTtlMs > 0
      ? new CachingLlmProvider(selectLlm(), cache, env.llmCacheTtlMs, logger)
      : selectLlm();

  // User memory — in-process by default (swap for Redis/vector in prod).
  const memory = new InMemoryMemoryStore();
  const engine = new ContextEngine(gateway, llm, logger, memory);

  const app = Fastify({ logger: false });

  // Lightweight request-scoped logging: correlate each request in our own logger.
  app.addHook("onResponse", async (req, reply) => {
    logger.info("http", {
      method: req.method,
      url: req.url,
      status: reply.statusCode,
      ms: Math.round(reply.elapsedTime),
    });
  });

  registerRoutes(app, engine);

  logger.info("app.ready", { gateway: env.gateway, llm: llm.name });
  return app;
}

/** Choose the LLM adapter from config (all implement the same LlmProvider port). */
function selectLlm(): LlmProvider {
  switch (env.llmProvider) {
    case "anthropic":
      return new AnthropicLlmProvider(env.anthropicKey, env.anthropicModel);
    case "ollama":
      return new OllamaLlmProvider(env.ollamaBaseUrl, env.ollamaModel);
    default:
      return new MockLlmProvider();
  }
}
