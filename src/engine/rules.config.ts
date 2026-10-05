import type { Intent } from "../domain.js";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  THE PERSONALIZATION CONFIG — the heart of the engine.
 *
 *  Every "what context does this intent need?" decision is DATA here, not code.
 *  Adding a new intent (e.g. "education", "travel") is a matter of adding one
 *  row below plus its keywords — no changes to the classifier, engine, or
 *  pipeline. That is the "config-driven, not if/else" requirement, made literal.
 *
 *    keywords  : signal words the rule-based classifier scores against
 *    primary   : context the answer truly needs (missing → LOW confidence)
 *    secondary : supporting context (missing → at most MEDIUM confidence)
 *    exclude   : context explicitly irrelevant. NOT used at runtime for
 *                selection (excluded is derived); kept as a documented intent
 *                and asserted as a test invariant (nothing here may leak into
 *                the selected set).
 *    maxWords  : base response length budget for this intent
 *
 *  Context keys are LOGICAL names (e.g. "10th House"). The mapping from a key to
 *  a concrete service + field lives in catalog.ts, so this table never touches
 *  raw upstream JSON.
 * ─────────────────────────────────────────────────────────────────────────
 */
export interface IntentRule {
  keywords: string[];
  primary: string[];
  secondary: string[];
  exclude: string[];
  maxWords: number;
}

/** Sentinel used by `general`: expands to every key in the catalog. */
export const ALL_CONTEXT = "*all*";

export const INTENT_RULES: Record<Intent, IntentRule> = {
  career: {
    keywords: [
      "job", "career", "work", "promotion", "business", "switch", "office",
      "salary", "resign", "interview", "profession", "hike", "appraisal",
    ],
    primary: ["Career Horoscope", "10th House"],
    secondary: ["Current Dasha", "Today's Panchang"],
    exclude: ["Relationship Horoscope"],
    maxWords: 250,
  },
  relationship: {
    keywords: [
      "relationship", "partner", "marriage", "love", "spouse", "romance",
      "dating", "breakup", "girlfriend", "boyfriend", "wife", "husband",
    ],
    primary: ["Relationship Horoscope", "7th House"],
    secondary: ["Moon Sign", "Current Dasha"],
    exclude: ["Career Horoscope"],
    maxWords: 220,
  },
  health: {
    keywords: [
      "health", "fitness", "wellness", "sleep", "energy", "stress", "illness",
      "diet", "body", "mental", "anxiety", "sick",
    ],
    primary: ["Health Horoscope", "6th House"],
    secondary: ["Moon Sign", "Today's Panchang"],
    exclude: ["Finance Horoscope"],
    maxWords: 200,
  },
  finance: {
    keywords: [
      "money", "finance", "invest", "investment", "wealth", "savings", "loan",
      "debt", "income", "expense", "financial", "profit", "stock",
    ],
    primary: ["Finance Horoscope", "2nd House"],
    secondary: ["Current Dasha", "Today's Panchang"],
    exclude: ["Relationship Horoscope"],
    maxWords: 220,
  },
  education: {
    keywords: [
      "education", "study", "exam", "school", "college", "university",
      "course", "learning", "degree", "class", "test", "results",
    ],
    primary: ["Career Horoscope", "10th House"],
    secondary: ["Current Dasha", "Today's Panchang"],
    exclude: ["Relationship Horoscope"],
    maxWords: 200,
  },
  general: {
    keywords: ["today", "guidance", "focus", "prioritize", "week", "overall", "life", "summarize", "summary"],
    primary: [ALL_CONTEXT],
    secondary: [],
    exclude: [],
    maxWords: 200,
  },
};

/**
 * Ambiguity threshold. When the top intent does not beat the runner-up by at
 * least this margin (in keyword hits), we treat the question as ambiguous and
 * fall back to `general` (widen context) rather than guess narrow.
 */
export const AMBIGUITY_MARGIN = 1;

/** Premium subscribers get a longer, more detailed answer. */
export const PREMIUM_WORD_BONUS = 100;

/** ISO language code → human-readable name for the prompt. */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  mr: "Marathi",
  bn: "Bengali",
};

/** Present the free-form tonePreference as a clean label. */
export function toneLabel(tonePreference: string): string {
  const t = (tonePreference || "neutral").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
