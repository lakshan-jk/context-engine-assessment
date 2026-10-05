import type { PromptBundle } from "../engine/prompt.js";
import { parseLlmJson, type LlmProvider, type LlmResult } from "./provider.js";

/**
 * Real LLM adapter — a single POST to the Anthropic Messages API via native
 * `fetch`. No SDK dependency: the request is a bearer-authenticated JSON POST,
 * which an SDK would only wrap. Swapping to another provider is a new class
 * implementing the same LlmProvider port.
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generate(prompt: PromptBundle): Promise<LlmResult> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();

    // Model was instructed to return strict JSON; parse defensively.
    return parseLlmJson(text);
  }
}
