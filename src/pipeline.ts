import type {
  DebugResponse,
  FetchOutcome,
  IntentResult,
  PersonalizeResponse,
  UserProfile,
} from "./domain.js";
import type { ServiceGateway } from "./gateway/gateway.js";
import type { LlmProvider } from "./llm/provider.js";
import type { Logger } from "./infra/logger.js";
import { InMemoryMemoryStore, type MemoryStore } from "./engine/memory.js";
import { classifyIntent } from "./engine/intent.js";
import { classifyIntentLlm } from "./llm/intent-classifier.js";
import { planFromIntent, selectedKeysForIntent } from "./engine/personalization.js";
import { resolveContext, servicesForKeys, type RawContext } from "./engine/catalog.js";
import { buildPrompt } from "./engine/prompt.js";
import { coverageConfidence, combineConfidence } from "./engine/confidence.js";
import {
  determinePhase,
  buildAlertPrompt,
  type AstroPeriod,
  type AlertResponse,
} from "./engine/alert.js";

/** A safe default profile used only when the user service itself is unavailable. */
const FALLBACK_USER: UserProfile = {
  id: "unknown",
  name: "there",
  language: "en",
  subscription: "free",
  tonePreference: "neutral",
  birthDetails: { date: "", time: "", place: "" },
};

/**
 * The Context Engine — the orchestration layer. Read `personalize()` top to
 * bottom: it is the seven-step pipeline the whole design exists to serve.
 *
 * Dependencies (gateway, llm) are injected — the composition root decides which
 * concrete adapters to use, so this class never mentions mock vs http vs which
 * LLM.
 */
export class ContextEngine {
  constructor(
    private readonly gateway: ServiceGateway,
    private readonly llm: LlmProvider,
    private readonly log: Logger,
    // Optional so existing callers/tests keep working; defaults to in-process memory.
    private readonly memory: MemoryStore = new InMemoryMemoryStore(),
  ) {}

  /** POST /personalize — the full pipeline. */
  async personalize(userId: string, question: string): Promise<PersonalizeResponse> {
    const started = Date.now();

    // 1. Classify intent — keyword-first, with a semantic LLM fallback for
    //    keyword-less / non-English / transliterated questions.
    const intentResult = await this.classifyWithFallback(question);

    // 2. From the intent alone, derive which context keys — and therefore which
    //    upstream services — we actually need. We fetch only those (+ user).
    const selectedKeys = selectedKeysForIntent(intentResult.intent);
    const services = servicesForKeys(selectedKeys);

    // 3. Fetch user + required services CONCURRENTLY, tolerating partial failure.
    const { raw, outcomes } = await this.gatherContext(userId, services);
    const anyUpstreamFailed = outcomes.some((o) => !o.ok);
    const userMissing = !raw.user;

    // 4. Build the personalization plan (needs the user profile for language/tone).
    const plan = planFromIntent(intentResult, raw.user ?? FALLBACK_USER);

    // 5. Resolve ONLY the selected keys into compact snippets (prompt optimization).
    const { snippets, unresolved } = resolveContext(plan.selectedContext, raw);

    // 6. Build the optimized prompt and generate — now with the user's memory
    //    (recent turns + recurring interests) for continuity. Memory is grounding
    //    for personalization only; astrological facts still come from context.
    const userMemory = this.memory.load(userId);
    const prompt = buildPrompt(question, plan, snippets, userMemory);
    const llmResult = await this.llm.generate(prompt);

    // 7. Assemble: confidence = min(coverage, model self-assessment); sources are
    //    the keys we actually resolved — engine-derived, never parsed from the LLM.
    const coverage = coverageConfidence({
      plan,
      unresolvedKeys: unresolved,
      anyUpstreamFailed,
      ambiguous: intentResult.ambiguous,
    });
    // If the user service failed we personalized on defaults → never claim HIGH.
    const floor = userMissing ? "MEDIUM" : "HIGH";
    const confidence = combineConfidence(
      combineConfidence(coverage, llmResult.selfConfidence),
      floor,
    );

    const sourcesUsed = snippets.map((s) => s.key);

    // 8. Update memory: record this turn (short-term) and the intent (long-term
    //    interest signal) so the NEXT request is continuity-aware.
    this.memory.recordIntent(userId, plan.intent);
    this.memory.appendTurn(userId, { question, answer: llmResult.answer, at: Date.now() });

    this.log.info("personalize.done", {
      intent: plan.intent,
      ambiguous: intentResult.ambiguous,
      selected: plan.selectedContext,
      unresolved,
      sourcesUsed,
      upstreamFailed: anyUpstreamFailed,
      coverage,
      selfConfidence: llmResult.selfConfidence,
      confidence,
      promptChars: prompt.metrics.promptChars,
      approxTokens: prompt.metrics.approxTokens,
      contextKeys: `${prompt.metrics.keysIncluded}/${prompt.metrics.keysAvailable}`,
      llm: this.llm.name,
      totalMs: Date.now() - started,
    });

    return { answer: llmResult.answer, confidence, sourcesUsed };
  }

  /**
   * POST /debug/personalization — explains the engine's reasoning WITHOUT the
   * LLM and without fetching context services. It fetches only `user` (needed
   * for language/tone), then returns the plan.
   */
  async debug(userId: string, question: string): Promise<DebugResponse> {
    const intentResult = await this.classifyWithFallback(question);

    let user: UserProfile | undefined;
    try {
      user = await this.gateway.getUser(userId);
    } catch (err) {
      this.log.warn("debug.userFetchFailed", { userId, err: String(err) });
    }

    const plan = planFromIntent(intentResult, user ?? FALLBACK_USER);

    return {
      intent: plan.intent,
      ambiguous: intentResult.ambiguous,
      intentScores: intentResult.scores,
      selectedContext: plan.selectedContext,
      excludedContext: plan.excludedContext,
      language: plan.language,
      tone: plan.tone,
      maxWords: plan.maxWords,
    };
  }

  /**
   * POST /alert — proactive guidance alert. Given an astrological period, work
   * out which phase (start/middle/end) today falls in, then have the LLM write a
   * short, tone-safe, humanized notification in the user's language. Returns null
   * phase if today is outside the period (nothing to send).
   */
  async alert(userId: string, period: AstroPeriod): Promise<AlertResponse> {
    const today = new Date().toISOString().slice(0, 10);
    const phase = determinePhase(period, today);
    if (!phase) {
      return { phase: null, message: null, confidence: "LOW", period: period.name };
    }

    let user: UserProfile | undefined;
    try {
      user = await this.gateway.getUser(userId);
    } catch (err) {
      this.log.warn("alert.userFetchFailed", { userId, err: String(err) });
    }

    const prompt = buildAlertPrompt(user ?? FALLBACK_USER, period, phase);
    const llmResult = await this.llm.generate(prompt);
    // Cap confidence at MEDIUM if we had to personalize on defaults.
    const confidence = user ? llmResult.selfConfidence : combineConfidence(llmResult.selfConfidence, "MEDIUM");

    this.log.info("alert.done", { userId, period: period.name, phase, sentiment: period.sentiment, confidence });
    return { phase, message: llmResult.answer, confidence, period: period.name };
  }

  /**
   * Classify intent: keyword-first (fast, free, deterministic), with a semantic
   * LLM fallback that fires ONLY when keywords find no signal (general with no
   * tie). That covers keyword-less, non-English, and transliterated questions
   * (e.g. Tamil "en vela epdi irukum") while keeping the common English path
   * free. Degrades safely: any failure or unrecognised answer keeps `general`.
   */
  private async classifyWithFallback(question: string): Promise<IntentResult> {
    const result = classifyIntent(question);
    if (result.intent === "general" && !result.ambiguous) {
      const llmIntent = await classifyIntentLlm(this.llm, question);
      if (llmIntent && llmIntent !== "general") {
        this.log.info("intent.llmFallback", { question, llmIntent });
        return { ...result, intent: llmIntent, ambiguous: false };
      }
    }
    return result;
  }

  /**
   * Fetch the user profile plus the required services CONCURRENTLY.
   *
   * Each fetch is wrapped by `timed()`, which captures its own success/failure
   * into a typed FetchOutcome and never rejects. That lets a single `Promise.all`
   * give us `allSettled`-style fault tolerance — one failure degrades only its
   * slice of context, never the whole request — while preserving richer
   * per-service data (latency, error) than `allSettled`'s bare { status, reason }.
   */
  private async gatherContext(
    userId: string,
    services: Set<string>,
  ): Promise<{ raw: RawContext; outcomes: FetchOutcome<unknown>[] }> {
    const jobs: Array<Promise<FetchOutcome<unknown>>> = [
      this.timed("user", () => this.gateway.getUser(userId)),
    ];
    if (services.has("kundli")) jobs.push(this.timed("kundli", () => this.gateway.getKundli(userId)));
    if (services.has("horoscope"))
      jobs.push(this.timed("horoscope", () => this.gateway.getHoroscope(userId)));
    if (services.has("panchang")) jobs.push(this.timed("panchang", () => this.gateway.getPanchang()));

    // Safe: every job resolves to a FetchOutcome (successes and failures alike),
    // so Promise.all never short-circuits on a rejection.
    const outcomes = await Promise.all(jobs);
    const raw: RawContext = {};
    for (const o of outcomes) {
      if (!o.ok) continue;
      if (o.service === "user") raw.user = o.data as RawContext["user"];
      else if (o.service === "kundli") raw.kundli = o.data as RawContext["kundli"];
      else if (o.service === "horoscope") raw.horoscope = o.data as RawContext["horoscope"];
      else if (o.service === "panchang") raw.panchang = o.data as RawContext["panchang"];
    }
    return { raw, outcomes };
  }

  /** Wrap a single fetch so it always resolves to an outcome with timing. */
  private async timed<T>(
    service: FetchOutcome<unknown>["service"],
    fn: () => Promise<T>,
  ): Promise<FetchOutcome<unknown>> {
    const start = Date.now();
    try {
      const data = await fn();
      const latencyMs = Date.now() - start;
      this.log.debug("upstream.ok", { service, latencyMs });
      return { service, ok: true, data, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;
      this.log.warn("upstream.fail", { service, latencyMs, err: String(err) });
      return { service, ok: false, error: String(err), latencyMs };
    }
  }
}
