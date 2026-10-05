# MyNaksh — Personalized AI Context Engine

The intelligence layer between MyNaksh's structured astrology services (User, Kundli, Horoscope,
Panchang) and an LLM. It **gathers user context, understands the question, selects only the
relevant context, personalizes the response, builds an optimized prompt, and returns a grounded
answer.**

> Design deep-dive lives in [`ARCHITECTURE.md`](./ARCHITECTURE.md). This README is how to run it
> and what I traded off.

---

## TL;DR

- **1 runtime dependency** (Fastify). LLM via native `fetch`, tests via `node:test`, logging
  hand-rolled. Every dependency has to earn its place.
- The **Personalization Engine is pure** (no I/O, no LLM) → context selection is exhaustively
  unit-tested and explainable via `/debug/personalization`.
- **Two ports** — `ServiceGateway` (mock **or** real HTTP) and `LlmProvider` (mock, **Ollama**,
  **or** Anthropic — three interchangeable adapters). Both default to mock, so it **runs with zero
  secrets and zero external services.**
- **Intent is keyword-based**: deterministic, free, and unit-tested — the right default for a
  routing decision.
- **Graceful degradation**: an upstream failure lowers `confidence`, it never 500s.

## Requirements

- **Node ≥ 20.6** (uses the built-in `.env` loader and `node:test`).

## Run

```bash
npm install
cp .env.example .env      # optional — sensible defaults work out of the box
npm run dev               # or: npm start   (http://localhost:3000)
```

> **Port note for this machine:** ports `3000` and `4000` were already in use by other apps
> during development. Override with `PORT` (and `UPSTREAM_BASE_URL` in http mode), e.g.
> `PORT=3100 npm start`.

### Try it

```bash
# Full pipeline
curl -s -X POST localhost:3000/personalize \
  -H 'content-type: application/json' \
  -d '{"userId":"user_101","question":"Should I consider changing my job in the next few months?"}'

# Explain the engine's reasoning — no LLM call
curl -s -X POST localhost:3000/debug/personalization \
  -H 'content-type: application/json' \
  -d '{"userId":"user_101","question":"Should I consider changing my job in the next few months?"}'
```

`/personalize` response:

```json
{
  "answer": "Here's what your chart suggests: …",
  "confidence": "HIGH",
  "sourcesUsed": ["Career Horoscope", "10th House", "Current Dasha", "Today's Panchang"]
}
```

`/debug/personalization` response (the internal reasoning, safe to expose):

```json
{
  "intent": "career",
  "ambiguous": false,
  "intentScores": { "career": 1, "relationship": 0, "health": 0, "finance": 0, "general": 0 },
  "selectedContext": ["Career Horoscope", "10th House", "Current Dasha", "Today's Panchang"],
  "excludedContext": ["Finance Horoscope", "Health Horoscope", "Relationship Horoscope", "…"],
  "language": "English",
  "tone": "Motivational",
  "maxWords": 350
}
```

### Test

```bash
npm test          # 23 tests: intent, selection, confidence, catalog, pipeline, HTTP
npm run typecheck # strict tsc, no emit
```

## Configuration (env)

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `GATEWAY` | `mock` | `mock` (in-process fixtures) or `http` (real fetch to the mock upstream server) |
| `UPSTREAM_BASE_URL` | `http://127.0.0.1:4000` | upstream base URL (http mode) |
| `UPSTREAM_TIMEOUT_MS` | `800` | per-call hard timeout |
| `UPSTREAM_RETRIES` | `2` | bounded retries (backoff + jitter; 5xx/timeout only) |
| `CACHE_TTL_MS` | `60000` | in-memory cache TTL |
| `MOCK_FAIL_SERVICES` | – | CSV of services to fail (`user,kundli,horoscope,panchang`) — demo degradation |
| `MOCK_LATENCY_MS` | `0` | inject latency into every mock response |
| `LLM_PROVIDER` | `mock` | `mock` \| `ollama` (local) \| `anthropic` (cloud; falls back to mock if no key) |
| `ANTHROPIC_API_KEY` | – | enables the Anthropic provider |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Anthropic model id |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | local Ollama daemon |
| `OLLAMA_MODEL` | `llama3.2` | local model id |

### Demonstrate the interesting paths

```bash
# Partial failure → confidence drops to LOW, the failed source is dropped, still answers
PORT=3100 MOCK_FAIL_SERVICES=horoscope npm start

# Real network path: boots a mock upstream server and hits it over HTTP via HttpGateway
PORT=3100 GATEWAY=http UPSTREAM_BASE_URL=http://127.0.0.1:4100 npm start

# Real LLM — local (free, no key) or cloud
LLM_PROVIDER=ollama npm start                                   # local llama3.2
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... npm start       # cloud
```

## How a request flows

```
classifyIntent → deriveRequiredServices → fetch(user + services, concurrent)
   → buildPlan → resolveContext (only selected keys) → buildPrompt → LLM → assembleResponse
```

`/debug` short-circuits after `buildPlan` (fetches only `user`, no LLM). Full detail, including
the diagram and the reasoning behind each decision, is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Project layout

```
src/
  server.ts / app.ts        # bootstrap + composition root (the one wiring place)
  pipeline.ts               # the 7-step orchestration — read this first
  domain.ts                 # all domain types
  engine/                   # PURE, unit-tested core
    intent.ts  rules.config.ts  personalization.ts  catalog.ts  prompt.ts  confidence.ts
  gateway/                  # PORT 1: ServiceGateway + Resilient decorator + mock/http adapters
  llm/                      # PORT 2: LlmProvider + mock/ollama/anthropic adapters
  infra/                    # env, logger, cache
  routes/                   # HTTP routes (Fastify schema validation)
  mock-server.ts            # standalone mock upstream services (for GATEWAY=http)
test/                       # node:test
```

---

## Assumptions

- The four upstream services are **mocked** (in-process fixtures; a standalone HTTP mock exists
  for the `http` gateway). `user_101` is seeded; any other `userId` gets a synthesized guest
  profile so exploration always works.
- **Intent is keyword-based.** For a routing decision I chose determinism, zero cost, and
  testability over an LLM classifier. Ambiguous/multi-intent questions deliberately **fall back to
  `general`** (widen context) rather than guess a narrow intent. (An LLM fallback for keyword-less
  questions is noted under *With another day*.)
- **`sourcesUsed` is engine-derived** — the keys actually resolved into the prompt — never parsed
  from the model, so it can't hallucinate.
- **Confidence = min(coverage, model self-assessment)**: the engine's data-coverage view combined
  conservatively with the model's own certainty. HIGH requires both to agree.
- Panchang is shared across users and cached by date; per-user data cached by `userId`.

## Trade-offs — what I intentionally simplified

- **In-memory cache**, not Redis. The `Cache` interface is the drop-in seam; I didn't want a
  Redis dependency for a single-node take-home.
- **Keyword intent**, not embeddings/LLM. Sufficient and honest at this scale; the classifier is a
  plain function with a clean signature, so it's a contained upgrade later.
- **Explicit `exclude` in the config is a *test invariant*, not runtime logic.** The excluded set
  is *derived* (`allKeys − selected`); the config's `exclude` is asserted in tests so two lists
  can't drift.
- **No streaming.** One-shot JSON response keeps the contract simple.
- **Fault/latency injection via env**, rather than a fancier chaos harness — enough to prove the
  degradation paths in a demo and in tests.

## With another day

- **LLM intent fallback** — promote the keyword classifier to an `IntentClassifier` port with a
  second implementation that spends one LLM call to classify *keyword-less* semantic questions
  (e.g. *"Should I hand in my notice?"*), firing only when keywords find no signal so the common
  path stays free. Prototyped and deliberately left out to keep intent detection deterministic and
  `/debug` LLM-free; the port seam makes it a contained addition. Would pair with **multi-intent
  blending** (union context of co-strong intents) and **classification caching**.
- **Redis** cache + request **rate limiting** + **idempotency** keys.
- **Streaming** responses and token-level cost/latency budgets per subscription tier.
- A small **eval harness**: a labeled question set asserting intent + selected sources, run in CI.
- **OpenTelemetry** traces spanning the fan-out, and per-upstream circuit breakers.

## Production concerns deliberately left out

- AuthN/Z, tenancy, secrets management (Vault/KMS), request signing.
- Horizontal scaling specifics, distributed cache invalidation, backpressure.
- Prompt-injection hardening beyond "answer only from provided context."
- PII handling / data-retention policy for birth details and questions.
