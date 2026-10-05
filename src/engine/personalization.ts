import type { Intent, IntentResult, PersonalizationPlan, UserProfile } from "../domain.js";
import { classifyIntent } from "./intent.js";
import { ALL_CONTEXT_KEYS } from "./catalog.js";
import {
  ALL_CONTEXT,
  INTENT_RULES,
  LANGUAGE_NAMES,
  PREMIUM_WORD_BONUS,
  toneLabel,
} from "./rules.config.js";

/**
 * Builds the PersonalizationPlan — the engine's central decision object.
 *
 * PURE and synchronous: given (question, userProfile) it decides intent, which
 * context to select, and how to shape the response. No network, no LLM. That
 * purity is what makes selection exhaustively unit-testable and lets the /debug
 * endpoint reuse this exact function.
 *
 * Note the split the architecture leans on:
 *   • WHICH context to select depends on intent only (the rules table).
 *   • Language / tone / length depend on the user profile.
 * Both are resolved here once the (cheap) user fetch is in hand.
 */
export function buildPlan(question: string, user: UserProfile): PersonalizationPlan {
  const intentResult = classifyIntent(question);
  return planFromIntent(intentResult, user);
}

/** Split out so tests can drive the plan from a fixed IntentResult. */
export function planFromIntent(intentResult: IntentResult, user: UserProfile): PersonalizationPlan {
  const { intent, score } = intentResult;
  const rule = INTENT_RULES[intent];

  const selectedContext = selectedKeysForIntent(intent);
  // Excluded is DERIVED, never hand-maintained: everything we did not select.
  const selectedSet = new Set(selectedContext);
  const excludedContext = ALL_CONTEXT_KEYS.filter((k) => !selectedSet.has(k));

  return {
    intent,
    intentScore: score,
    language: LANGUAGE_NAMES[user.language] ?? user.language,
    tone: toneLabel(user.tonePreference),
    maxWords: rule.maxWords + (user.subscription === "premium" ? PREMIUM_WORD_BONUS : 0),
    selectedContext,
    excludedContext,
  };
}

/**
 * The context keys an intent selects (primary first, de-duplicated). Exposed so
 * the pipeline can derive which upstream services to fetch from the intent alone,
 * before the plan (which also needs the user profile) is built.
 */
export function selectedKeysForIntent(intent: Intent): string[] {
  const rule = INTENT_RULES[intent];
  if (rule.primary.includes(ALL_CONTEXT)) return [...ALL_CONTEXT_KEYS];
  return [...new Set([...rule.primary, ...rule.secondary])];
}
