import type { Intent, IntentResult } from "../domain.js";
import { INTENT_RULES, AMBIGUITY_MARGIN } from "./rules.config.js";

/**
 * Deterministic, dependency-free intent classifier.
 *
 * Scores each specific intent by counting matched keywords in the question,
 * then decides:
 *   • a clear winner (beats the runner-up by ≥ AMBIGUITY_MARGIN) → that intent
 *   • a tie / near-tie between specific intents → `general` (ambiguity WIDENS
 *     context; we never force a confident-but-wrong narrow guess)
 *   • no keyword hits at all → `general`
 *
 * Chosen over an LLM classifier deliberately: routing wants determinism, zero
 * cost, and unit-testability. It is a plain function today; if semantic intent
 * is ever needed it can be promoted to a port without changing callers.
 */
export function classifyIntent(question: string): IntentResult {
  const tokens = new Set(tokenize(question));

  const scores = emptyScores();
  for (const [intent, rule] of Object.entries(INTENT_RULES) as [Intent, typeof INTENT_RULES[Intent]][]) {
    if (intent === "general") continue; // general is the fallback, not keyword-scored
    scores[intent] = rule.keywords.reduce((n, kw) => n + (tokens.has(kw) ? 1 : 0), 0);
  }

  const ranked = (Object.entries(scores) as [Intent, number][])
    .filter(([intent]) => intent !== "general")
    .sort((a, b) => b[1] - a[1]);

  const [topIntent, topScore] = ranked[0];
  const runnerUpScore = ranked[1]?.[1] ?? 0;

  // No signal at all → general guidance, modest confidence.
  if (topScore === 0) {
    return { intent: "general", score: 0.4, scores, ambiguous: false };
  }

  // Two specific intents too close to call → widen to general.
  if (topScore - runnerUpScore < AMBIGUITY_MARGIN) {
    return { intent: "general", score: 0.5, scores, ambiguous: true };
  }

  // Clear winner. Confidence grows with hits and with the margin, saturating at 1.
  const score = Math.min(1, 0.5 + topScore * 0.15 + (topScore - runnerUpScore) * 0.1);
  return { intent: topIntent, score, scores, ambiguous: false };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function emptyScores(): Record<Intent, number> {
  return { career: 0, relationship: 0, health: 0, finance: 0, education: 0, general: 0 };
}
