import Fastify, { type FastifyInstance } from "fastify";
import { fixtures } from "./gateway/fixtures.js";
import { env } from "./infra/env.js";
import { logger } from "./infra/logger.js";

/**
 * Standalone mock upstream server implementing the four backend services the
 * brief describes. Used when GATEWAY=http, so the HttpGateway makes REAL network
 * calls and the resilience layer is exercised end to end.
 *
 * Honors the same fault/latency injection env vars as the in-process mock, so
 * partial-failure behavior can be demonstrated over HTTP too.
 */
export function buildMockUpstreamServer(): FastifyInstance {
  const app = Fastify({ logger: false });

  const guard = async (service: string) => {
    if (env.mockLatencyMs > 0) await new Promise((r) => setTimeout(r, env.mockLatencyMs));
    if (env.mockFailServices.includes(service)) {
      const err = new Error(`Injected failure for "${service}"`);
      (err as { statusCode?: number }).statusCode = 503;
      throw err;
    }
  };

  app.get<{ Params: { userId: string } }>("/users/:userId", async (req) => {
    await guard("user");
    return fixtures.user(req.params.userId);
  });
  app.get<{ Params: { userId: string } }>("/kundli/:userId", async (req) => {
    await guard("kundli");
    return fixtures.kundli(req.params.userId);
  });
  app.get<{ Params: { userId: string } }>("/horoscope/:userId", async (req) => {
    await guard("horoscope");
    return fixtures.horoscope(req.params.userId);
  });
  app.get("/panchang", async () => {
    await guard("panchang");
    return fixtures.panchang();
  });

  return app;
}

// Allow running the mock server on its own: `tsx src/mock-server.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = buildMockUpstreamServer();
  app
    .listen({ port: env.mockUpstreamPortStandalone, host: "0.0.0.0" })
    .then(() => logger.info("mock-upstream.listening", { port: env.mockUpstreamPortStandalone }))
    .catch((err) => {
      logger.error("mock-upstream.failed", { err: String(err) });
      process.exit(1);
    });
}
