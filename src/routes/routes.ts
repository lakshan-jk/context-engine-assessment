import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { FastifyInstance } from "fastify";
import type { ContextEngine } from "../pipeline.js";

// Demo playground — a single static HTML page served at GET /. Read once at
// startup with the Node built-in fs (no new dependency), so the "1 runtime
// dependency = Fastify" principle holds. Optional: delete this + the route to
// return to a pure-API service.
const PLAYGROUND_HTML = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../public/playground.html"),
  "utf8",
);

/**
 * HTTP routes. Request validation is Fastify's built-in JSON-schema — no
 * separate validation dependency. Handlers stay thin: they translate HTTP to a
 * pipeline call and back, nothing more.
 */
const personalizeBodySchema = {
  type: "object",
  required: ["userId", "question"],
  additionalProperties: false,
  properties: {
    userId: { type: "string", minLength: 1 },
    question: { type: "string", minLength: 1, maxLength: 1000 },
  },
} as const;

interface PersonalizeBody {
  userId: string;
  question: string;
}

const alertBodySchema = {
  type: "object",
  required: ["userId", "period"],
  additionalProperties: false,
  properties: {
    userId: { type: "string", minLength: 1 },
    period: {
      type: "object",
      required: ["name", "start", "end", "sentiment"],
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 1 },
        start: { type: "string", minLength: 1 },
        end: { type: "string", minLength: 1 },
        sentiment: { type: "string", enum: ["good", "relief", "caution"] },
      },
    },
  },
} as const;

interface AlertBody {
  userId: string;
  period: { name: string; start: string; end: string; sentiment: "good" | "relief" | "caution" };
}

export function registerRoutes(app: FastifyInstance, engine: ContextEngine): void {
  app.get("/health", async () => ({ status: "ok" }));

  // Demo playground UI (see PLAYGROUND_HTML above).
  app.get("/", async (_req, reply) => {
    reply.type("text/html").send(PLAYGROUND_HTML);
  });

  app.post<{ Body: PersonalizeBody }>(
    "/personalize",
    { schema: { body: personalizeBodySchema } },
    async (req) => {
      const { userId, question } = req.body;
      return engine.personalize(userId, question);
    },
  );

  app.post<{ Body: PersonalizeBody }>(
    "/debug/personalization",
    { schema: { body: personalizeBodySchema } },
    async (req) => {
      const { userId, question } = req.body;
      return engine.debug(userId, question);
    },
  );

  app.post<{ Body: AlertBody }>(
    "/alert",
    { schema: { body: alertBodySchema } },
    async (req) => {
      const { userId, period } = req.body;
      return engine.alert(userId, period);
    },
  );
}
