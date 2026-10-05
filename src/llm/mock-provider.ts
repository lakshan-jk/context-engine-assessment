import type { Confidence } from "../domain.js";
import type { PromptBundle } from "../engine/prompt.js";
import type { LlmProvider, LlmResult } from "./provider.js";

/**
 * Deterministic, grounded mock LLM — the default so the service runs with zero
 * secrets and tests stay stable.
 *
 * It does not fabricate: it composes an answer strictly from the context lines
 * in the prompt, and derives its self-confidence from how much context it was
 * actually given (none → LOW, thin → MEDIUM, rich → HIGH). This mirrors how a
 * well-behaved real model should behave under our grounding instructions.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  async generate(prompt: PromptBundle): Promise<LlmResult> {
    const contextLines = extractContextLines(prompt.user);
    const selfConfidence = confidenceFromContext(contextLines.length);

    const answer =
      contextLines.length === 0
        ? "I don't have enough of your chart details right now to answer this reliably. Please try again shortly."
        : compose(contextLines);

    return { answer, selfConfidence };
  }
}

function extractContextLines(userPrompt: string): string[] {
  return userPrompt
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter((l) => l && !l.startsWith("(no astrological context"));
}

function confidenceFromContext(count: number): Confidence {
  if (count === 0) return "LOW";
  if (count <= 1) return "MEDIUM";
  return "HIGH";
}

function compose(lines: string[]): string {
  const points = lines.map((l) => `• ${l}`).join("\n");
  return [
    "Here's what your chart suggests:",
    points,
    "Taken together, the signals lean encouraging — move deliberately, and let the stronger placements guide your timing.",
  ].join("\n");
}
