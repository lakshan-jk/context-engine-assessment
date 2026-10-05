import { buildApp } from "./app.js";
import { buildMockUpstreamServer } from "./mock-server.js";
import { env } from "./infra/env.js";
import { logger } from "./infra/logger.js";

/**
 * Bootstrap. When GATEWAY=http we also boot the mock upstream server in-process
 * so the whole thing runs with a single command — the HttpGateway then makes
 * real network calls to it. With the default (mock) gateway, no upstream server
 * is needed at all.
 */
async function main(): Promise<void> {
  if (env.gateway === "http") {
    const upstream = buildMockUpstreamServer();
    await upstream.listen({ port: env.mockUpstreamPortStandalone, host: "0.0.0.0" });
    logger.info("mock-upstream.listening", { port: env.mockUpstreamPortStandalone });
  }

  const app = buildApp();
  await app.listen({ port: env.port, host: "0.0.0.0" });
  logger.info("server.listening", { port: env.port });
}

main().catch((err) => {
  logger.error("server.failed", { err: String(err) });
  process.exit(1);
});
