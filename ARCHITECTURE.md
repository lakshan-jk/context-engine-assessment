# Architecture — Personalized AI Context Engine

> The intelligence layer between MyNaksh's structured astrology services and an LLM.
> Its job is **not** to chat — it is to **select the right context and discard the rest**,
> then produce a grounded, personalized answer.

---

## 1. Guiding principle

The brief evaluates *"how you design the layer between structured backend services and an
LLM."* So one idea governs every decision here:

> **Context selection is the product. Everything else is plumbing.**

Consequences:

- The selection logic is **pure** (no I/O, no framework, no LLM) → trivially testable and
  defensible. "Why did it pick the 10th House and drop the Relationship Horoscope?" is
  answered by a unit test, not a hand-wave.
- Plumbing (HTTP, fetching, caching, logging) is deliberately **boring and minimal**. If a
  reviewer spends more time reading the Fastify setup than `selectContext`, the design failed.

## 2. Minimal tech stack (1 runtime dependency)

Every dependency is a liability we must justify. What we kept, and what we refused:

| Layer            | Choice                         | Refused (why)                                              |
| ---------------- | ------------------------------ | --------------------------------------------------------- |
| Language         | TypeScript                     | types *are* the design doc for this problem               |
| HTTP server      | **Fastify** (only runtime dep) | NestJS (heavy); bare `node:http` (boilerplate)            |
| Input validation | Fastify built-in JSON-schema   | `zod` — Fastify already validates request bodies natively |
| LLM call         | native `fetch`                 | `@anthropic-ai/sdk` — one POST doesn't need an SDK         |
| Logging          | ~30-line structured logger     | `pino` + `pino-pretty` — trivial to hand-roll             |
| Tests            | `node:test` + `node:assert`    | `vitest`/`jest` — Node ships a runner; zero test deps      |
| Dev runtime      | `tsx` (dev-only)               | build step in dev                                         |

**Net runtime dependencies: 1.**

## 3. The pipeline

`POST /personalize` is a linear, readable flow. `POST /debug/personalization` short-circuits
after `buildPlan` — it never fetches context services and never calls the LLM.

```
                 ┌───────────────────────── /debug stops here ─────────────────────────┐
                 │                                                                      │
question ─▶ classifyIntent ─▶ deriveRequiredServices ─▶ fetch(user + services) ─▶ buildPlan
                                                              (concurrent,              │
                                                             fault-tolerant)            ▼
                                                                             resolveContext (only
                                                                              selected keys → snippets)
                                                                                        │
                                                                                        ▼
                                                                                   buildPrompt
                                                                                        │
                                                                                        ▼
                                                                              LlmProvider.generate
                                                                                        │
                                                                                        ▼
                                                                             assembleResponse
                                                                     (answer, confidence, sourcesUsed)
```

### A subtlety that shapes `/debug`: selection is pure, personalization is not

- **Which context keys** to select depends on **intent only** (the config table) → pure.
- **Language / tone / length** depend on the **user profile** → needs one fetch.

So `/debug` (whose response includes `language` and `tone`) fetches **only `user`**, runs
classification + plan, and returns. No context fetch, no LLM. Cheap and honest.

### Two optimizations, not one

- **Fetch optimization** — from the intent we know the selected keys → we know exactly which
  upstream services are needed, and fetch *only those* (plus `user`), concurrently.
- **Prompt optimization** — only the *resolved selected snippets* enter the prompt, never the
  full service payloads. We log prompt size + keys-included-vs-catalog to prove the reduction.

## 4. Components & boundaries

Only **two ports** — the two things that realistically change. We deliberately do **not**
abstract the cache or the classifier (premature interfaces read as junior). The classifier stays a
plain function; an `IntentClassifier` port is only justified once a second implementation (an LLM
fallback) is real — noted as future work in the README, not built speculatively.

```
src/
  server.ts              # bootstrap
  app.ts                 # composition root — the ONE place wiring is decided
  pipeline.ts            # the 7-step orchestration, readable end-to-end
  domain.ts              # all domain types (small domain → one file)
  engine/                # ── pure, no I/O, exhaustively unit-tested ──
    intent.ts            #   keyword scoring + ambiguity → general (pure function)
    rules.config.ts      #   THE intent→context table (data, not code)
    personalization.ts   #   (question, user) → PersonalizationPlan
    catalog.ts           #   logical key → {service, extract snippet}
    prompt.ts            #   plan + snippets → prompt bundle (+ size metrics)
    confidence.ts        #   coverage → HIGH/MEDIUM/LOW
  gateway/               # ── PORT 1: upstream services ──
    gateway.ts           #   ServiceGateway interface + Resilient decorator (cache+retry+timeout)
    mock-gateway.ts      #   in-memory fixtures + latency/fault injection (DEFAULT)
    http-gateway.ts      #   real fetch adapter (env-toggled) — proves the port earns its keep
  llm/                   # ── PORT 2: the LLM (3 interchangeable adapters) ──
    provider.ts          #   LlmProvider interface + shared defensive JSON parser
    mock-provider.ts     #   deterministic, grounded, self-assesses confidence (DEFAULT)
    ollama-provider.ts   #   native fetch to a local Ollama daemon (real, free, offline)
    anthropic-provider.ts#   native fetch to Anthropic Messages API
  infra/                 # env, logger, cache
  routes/                # personalize.ts, debug.ts, health.ts
test/                    # node:test unit + integration
```

## 5. Key design decisions (and the trade-offs)

### 5.1 Config-driven selection
The intent→context mapping is a **data table** (`rules.config.ts`): `primary`, `secondary`,
`exclude`, `keywords`, `maxWords` per intent. Adding an intent (`education`, `travel`) is a new
row — **zero code change**. This is the "extensible, not if/else" requirement, made literal.

### 5.2 Intent classification — deterministic, fail-safe on ambiguity
Keyword scoring: fast, free, transparent, testable. Its weakness is multi-intent
(*"work and love this week?"*). Rule: **a clear winner wins; a tie/near-tie falls back to
`general`** (widen context). Ambiguity broadens context, never guesses narrow. Classifier is a
plain function today; it becomes a port only if we add an LLM classifier (YAGNI). The keyword-less
semantic case (e.g. *"Should I hand in my notice?"*) is exactly what that LLM fallback would cover —
noted as future work, not built, to keep intent deterministic and `/debug` LLM-free.

### 5.3 Excluded set is derived, not maintained twice
With a primary+secondary **allow-list**, `excluded = allKeys − selected`. The config's explicit
`exclude` is kept as a **test invariant** (assert nothing in `exclude` leaks into `selected`),
not as runtime logic — two hand-maintained lists would drift.

### 5.4 `sourcesUsed` is engine-derived, never parsed from the LLM
It is exactly the **keys we resolved into the prompt**. Deterministic, honest, unhallucinatable.
A failed Panchang is simply absent from `sourcesUsed`.

### 5.5 Confidence = min(coverage, model self-assessment)
Two independent signals, combined **conservatively (take the lower)**:

| Signal | Source | Meaning |
| --- | --- | --- |
| **Coverage** | engine, deterministic | did primary/secondary data actually arrive? |
| **Self-assessment** | LLM, semantic | *"given this context, could I answer well?"* |

Coverage rules: **HIGH** = all primary resolved + no upstream failure + clear intent;
**MEDIUM** = a secondary dropped, or intent fell back to `general`; **LOW** = any primary key
unresolved. Final confidence is the more conservative of the two. You only get HIGH when the
data *and* the model agree. `LlmProvider.generate → { answer, selfConfidence }`; a parse failure
degrades to `MEDIUM`, never a 500.

### 5.6 Graceful degradation over correctness-theater
An upstream failure **lowers confidence, never 500s**. `user` failing is special: fall back to
default language/tone (English/neutral) and cap confidence at MEDIUM. Only genuine engine bugs
return 500. Malformed request bodies return 400 (Fastify schema).

### 5.7 Resilience & caching (the boring-but-correct layer)
`ResilientGateway` decorates any `ServiceGateway`: per-call **timeout** (AbortController for
HTTP), **bounded retry** with exponential backoff + jitter (retry 5xx/timeout, never 4xx), and
a **read-through cache**. Cache keys: `user:{id}`, `kundli:{id}`, `horoscope:{id}` per user;
`panchang:{date}` shared across all users (highest hit-rate). The same decorator works over the
mock or http adapter — that is the port abstraction paying off.

## 6. Observability
Structured logs per request: `requestId`, intent, selected/excluded keys, per-service latency +
outcome, total latency, prompt size (chars + approx tokens), keys-included-vs-catalog, cache
hits/misses, final confidence. Enough to answer "what did the engine decide, and why, and how
fast" from logs alone.

## 7. Deliberately out of scope (honest omissions)
Single-node, in-memory cache (Redis is the drop-in via the `Cache` seam). No auth / rate-limit /
tenancy. No streaming responses. No real vector retrieval (keyword intent is sufficient and
honest at this scale; an LLM intent fallback is noted as future work). No prompt-injection
hardening beyond "answer only from provided context."
No OpenTelemetry. These are called out in the README as "with another day" work.
