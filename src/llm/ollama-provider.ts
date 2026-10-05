import type { PromptBundle } from "../engine/prompt.js";
import { parseLlmJson, type LlmProvider, type LlmResult } from "./provider.js";

/**
 * Local LLM adapter — talks to a running Ollama daemon over its HTTP API via
 * native `fetch`. A third implementation of the same LlmProvider port (mock,
 * Anthropic, Ollama), which is exactly the "swappable provider" property the
 * design set out to demonstrate: the pipeline is unchanged.
 *
 * We pass `format: "json"` so Ollama constrains the output to valid JSON, then
 * reuse the shared defensive parser to pull out `{ answer, confidence }`.
 */
export class OllamaLlmProvider implements LlmProvider {
  readonly name = "ollama";

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async generate(prompt: PromptBundle): Promise<LlmResult> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: "json", // constrain output to a JSON object
        options: { temperature: 0.6 },
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ollama API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const text = (data.message?.content ?? "").trim();
    return parseLlmJson(text);
  }
}
