import { LLMProviderError } from "./errors";
import { stripToScript } from "./strip-to-script";
import { THE_SYSTEM_PROMPT } from "./system-prompt";
import type { LLMProvider } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 2048;

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
}

interface AnthropicMessagesResponse {
  content?: Array<{ type: string; text?: string }>;
}

export class AnthropicProvider implements LLMProvider {
  public readonly id = "anthropic" as const;
  private readonly config: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig) {
    this.config = config;
  }

  async generateVoxelScript(prompt: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: MAX_TOKENS,
          system: THE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch (e) {
      throw new LLMProviderError(
        "anthropic",
        "network",
        undefined,
        e instanceof Error ? e.message : "Network error",
      );
    }

    if (!response.ok) {
      throw new LLMProviderError(
        "anthropic",
        "http",
        response.status,
        `Anthropic returned HTTP ${response.status}`,
      );
    }

    let body: AnthropicMessagesResponse;
    try {
      body = (await response.json()) as AnthropicMessagesResponse;
    } catch {
      throw new LLMProviderError(
        "anthropic",
        "shape",
        undefined,
        "Anthropic response was not JSON.",
      );
    }

    const text = body.content?.[0]?.text ?? "";
    return stripToScript("anthropic", text);
  }
}
