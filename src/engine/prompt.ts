import type { ContextSnippet, PersonalizationPlan } from "../domain.js";
import type { UserMemory } from "./memory.js";
import { ALL_CONTEXT_KEYS } from "./catalog.js";

/** The prompt handed to an LlmProvider, plus metrics we log to prove optimization. */
export interface PromptBundle {
  system: string;
  user: string;
  metrics: {
    promptChars: number;
    approxTokens: number; // rough chars/4 estimate — enough for logging
    keysIncluded: number;
    keysAvailable: number; // total catalog size, for the "N of M" ratio
  };
}

/**
 * Builds an OPTIMIZED prompt: only the resolved, selected snippets — never the
 * full upstream payloads. The system message pins language, tone, and length,
 * and grounds the model: answer ONLY from the provided context, and if it is
 * insufficient, say so and lower confidence.
 *
 * The model is asked to reply as strict JSON `{ answer, confidence }` so the
 * provider can surface a self-assessed confidence alongside the text.
 */
export function buildPrompt(
  question: string,
  plan: PersonalizationPlan,
  snippets: ContextSnippet[],
  memory?: UserMemory,
): PromptBundle {
  const contextBlock =
    snippets.length > 0
      ? snippets.map((s) => `- ${s.text}`).join("\n")
      : "(no astrological context could be retrieved)";

  // Memory is grounding for CONTINUITY only — never for astrological facts. Kept
  // compact (recent turns + top interests) so it costs few tokens.
  const hasMemory = !!memory && (memory.recentTurns.length > 0 || memory.interests.length > 0);
  // NB: memory bullets intentionally do NOT start with "- " — the mock LLM's
  // context extractor keys on "- " lines, so this keeps memory out of the
  // "chart context" it composes from. Real providers read the labelled section.
  const memoryLines = hasMemory
    ? [
        "Prior conversation & interests (for continuity only — do NOT treat as chart facts):",
        ...memory!.recentTurns.map((t) => `  • Earlier they asked: "${t.question}"`),
        memory!.interests.length > 0
          ? `  • They often ask about: ${memory!.interests.join(", ")}`
          : "",
      ].filter(Boolean)
    : [];

  const system = [
    "You are MyNaksh, a warm, responsible astrology guide.",
    `Respond in ${plan.language}. Use a ${plan.tone.toLowerCase()} tone.`,
    `Keep the answer under ${plan.maxWords} words.`,
    "Ground every astrological statement ONLY in the provided context below.",
    "Do not invent chart details, dates, or predictions beyond that context.",
    hasMemory
      ? "You may use the prior conversation for continuity and a personal touch, but never treat it as chart data."
      : "",
    "If the context is insufficient to answer well, say so plainly and lower your confidence.",
    "",
    "Reply as strict minified JSON with exactly these keys:",
    '{"answer": string, "confidence": "HIGH" | "MEDIUM" | "LOW"}',
    "`confidence` reflects how well the provided context supports a useful answer.",
  ].filter(Boolean).join("\n");

  const user = [
    `User question: ${question}`,
    ...(memoryLines.length > 0 ? ["", ...memoryLines] : []),
    "",
    "Relevant context:",
    contextBlock,
  ].join("\n");

  const promptChars = system.length + user.length;
  return {
    system,
    user,
    metrics: {
      promptChars,
      approxTokens: Math.ceil(promptChars / 4),
      keysIncluded: snippets.length,
      keysAvailable: ALL_CONTEXT_KEYS.length,
    },
  };
}
