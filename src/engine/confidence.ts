import type { Confidence, PersonalizationPlan } from "../domain.js";
import { INTENT_RULES, ALL_CONTEXT } from "./rules.config.js";

const RANK: Record<Confidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** The more conservative (lower) of two confidence levels. */
export function combineConfidence(a: Confidence, b: Confidence): Confidence {
  return RANK[a] <= RANK[b] ? a : b;
}

/**
 * COVERAGE confidence — the engine's own, deterministic view of how well we
 * assembled the context, independent of the model:
 *
 *   HIGH   = every PRIMARY key resolved, no upstream failed, intent was a clear winner
 *   MEDIUM = a SECONDARY key dropped, or we fell back to `general` (ambiguous)
 *   LOW    = any PRIMARY key unresolved (its service failed or data missing)
 *
 * This is combined with the model's self-assessment (taking the lower) so the
 * final confidence only reaches HIGH when the data AND the model agree.
 */
export function coverageConfidence(args: {
  plan: PersonalizationPlan;
  unresolvedKeys: string[];
  anyUpstreamFailed: boolean;
  ambiguous: boolean;
}): Confidence {
  const { plan, unresolvedKeys, anyUpstreamFailed, ambiguous } = args;
  const unresolved = new Set(unresolvedKeys);

  const rule = INTENT_RULES[plan.intent];
  // `general` uses ALL_CONTEXT as primary — treat all selected keys as primary there.
  const primaryKeys = rule.primary.includes(ALL_CONTEXT) ? plan.selectedContext : rule.primary;

  const anyPrimaryMissing = primaryKeys.some((k) => unresolved.has(k));
  if (anyPrimaryMissing) return "LOW";

  const anySecondaryMissing = plan.selectedContext.some((k) => unresolved.has(k));
  if (anySecondaryMissing || ambiguous || anyUpstreamFailed) return "MEDIUM";

  return "HIGH";
}
