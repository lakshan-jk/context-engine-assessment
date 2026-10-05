import type { Confidence } from "../domain.js";
import type { PromptBundle } from "../engine/prompt.js";

/**
 * ── PORT 2: the LLM ────────────────────────────────────────────
 *
 * The engine depends only on this interface. The provider returns STRUCTURE,
 * not a bare string: alongside the answer it reports the model's own
 * `selfConfidence`, which the pipeline combines (conservatively) with the
 * engine's coverage confidence.
 */
export interface LlmResult {
  answer: string;
  selfConfidence: Confidence;
}

export interface LlmProvider {
  readonly name: string;
  generate(prompt: PromptBundle): Promise<LlmResult>;
}

/**
 * Shared, defensive parser for the strict-JSON reply we ask the model for.
 * A formatting hiccup must never 500 the request — on any parse failure we fall
 * back to treating the raw text as the answer with MEDIUM self-confidence.
 */
export function parseLlmJson(raw: string): LlmResult {
  const cleaned = stripCodeFence(raw).trim();
  try {
    const obj = JSON.parse(cleaned) as { answer?: unknown; confidence?: unknown };
    const answer = typeof obj.answer === "string" ? obj.answer : raw.trim();
    const selfConfidence = normalizeConfidence(obj.confidence);
    return { answer, selfConfidence };
  } catch {
    return { answer: raw.trim(), selfConfidence: "MEDIUM" };
  }
}

function stripCodeFence(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return m ? m[1] : s;
}

function normalizeConfidence(v: unknown): Confidence {
  const up = String(v).toUpperCase();
  return up === "HIGH" || up === "MEDIUM" || up === "LOW" ? (up as Confidence) : "MEDIUM";
}
