import type { Intent } from "../domain.js";
import type { PromptBundle } from "../engine/prompt.js";
import type { LlmProvider } from "./provider.js";

/**
 * LLM-based intent classifier — the semantic fallback.
 *
 * The keyword classifier (engine/intent.ts) is fast, free, and deterministic,
 * but it only knows English keywords. It misses:
 *   • keyword-less semantic questions ("Should I hand in my notice?")
 *   • other languages ("நான் என் வேலையை மாற்ற வேண்டுமா?")
 *   • transliterated / romanized languages — Tanglish/Hinglish ("en vela epdi irukum?")
 *
 * This fires ONLY when the keyword classifier finds no signal, so the common
 * (English keyword) path stays free and deterministic — we spend one LLM call
 * only on the hard cases. Lives in llm/ (not the pure engine) because it does I/O.
 *
 * Reuses LlmProvider.generate + its defensive JSON parser: we ask the model to
 * put the chosen intent in the `answer` field, then validate it against the known
 * intents. Anything unrecognised → null, so the caller safely keeps `general`.
 */

const VALID_INTENTS: Intent[] = [
  "career",
  "relationship",
  "health",
  "finance",
  "education",
  "general",
];

export async function classifyIntentLlm(
  llm: LlmProvider,
  question: string,
): Promise<Intent | null> {
  const system = [
    "You are an intent classifier for an astrology assistant.",
    `Classify the user's question into EXACTLY ONE of: ${VALID_INTENTS.join(", ")}.`,
    "The question may be in ANY language or script, including romanized Indian",
    "languages (Tamil/Hindi written in English letters, e.g. 'en vela epdi irukum'",
    "means a career/work question). Classify by MEANING, not by matching words.",
    "If it doesn't clearly fit a specific topic, use general.",
    "",
    "Reply as strict minified JSON with exactly these keys:",
    '{"answer": "<one intent>", "confidence": "HIGH" | "MEDIUM" | "LOW"}',
  ].join("\n");

  const user = `Question: ${question}`;
  const promptChars = system.length + user.length;

  const prompt: PromptBundle = {
    system,
    user,
    metrics: {
      promptChars,
      approxTokens: Math.ceil(promptChars / 4),
      keysIncluded: 0,
      keysAvailable: 0,
    },
  };

  try {
    const result = await llm.generate(prompt);
    const guess = result.answer.trim().toLowerCase();
    // Model may reply "career." or "career intent" — take the first valid match.
    const match = VALID_INTENTS.find((i) => guess.includes(i));
    return match ?? null;
  } catch {
    return null; // any failure → caller keeps the keyword result (general)
  }
}
