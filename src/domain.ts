/**
 * The domain vocabulary of the engine. Kept in one file because the domain is
 * small and it reads better as a single glossary than scattered across modules.
 */

// ── Upstream service response shapes ───────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  language: string; // ISO code, e.g. "en"
  subscription: "free" | "premium";
  tonePreference: string; // e.g. "motivational"
  birthDetails: { date: string; time: string; place: string };
}

export interface Kundli {
  lagna: string;
  moonSign: string;
  currentDasha: { mahadasha: string; antardasha: string };
  houses: Record<string, { lord: string; strength: string }>;
}

export interface Horoscope {
  career: string;
  finance: string;
  health: string;
  relationship: string;
}

export interface Panchang {
  date: string;
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
}

export type ServiceName = "user" | "kundli" | "horoscope" | "panchang";

// ── Engine domain ──────────────────────────────────────────────

export type Intent = "career" | "relationship" | "health" | "finance" | "general" |"education";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

/** Output of intent classification — includes raw scores for explainability. */
export interface IntentResult {
  intent: Intent;
  /** 0–1 confidence in the classification itself. */
  score: number;
  /** Per-intent keyword hit counts (surfaced in /debug + logs). */
  scores: Record<Intent, number>;
  /** True when we fell back to `general` because the question was ambiguous. */
  ambiguous: boolean;
}

/**
 * The internal decision object — the heart of the engine. Produced purely from
 * (question, userProfile); consumed by both /personalize and /debug.
 */
export interface PersonalizationPlan {
  intent: Intent;
  intentScore: number;
  language: string; // human-readable, e.g. "English"
  tone: string; // human-readable, e.g. "Motivational"
  maxWords: number;
  selectedContext: string[]; // logical context keys, primary first
  excludedContext: string[]; // derived: all catalog keys − selected
}

/** One upstream fetch outcome, success or failure, with timing. */
export interface FetchOutcome<T> {
  service: ServiceName;
  ok: boolean;
  data?: T;
  error?: string;
  latencyMs: number;
}

/** A resolved piece of context, ready to drop into the prompt. */
export interface ContextSnippet {
  key: string; // logical key, e.g. "10th House"
  service: ServiceName;
  text: string; // compact, prompt-ready line
}

/** The public API response. */
export interface PersonalizeResponse {
  answer: string;
  confidence: Confidence;
  sourcesUsed: string[];
}

/** The /debug/personalization response — explains the engine's reasoning. */
export interface DebugResponse {
  intent: Intent;
  ambiguous: boolean;
  intentScores: Record<Intent, number>;
  selectedContext: string[];
  excludedContext: string[];
  language: string;
  tone: string;
  maxWords: number;
}
