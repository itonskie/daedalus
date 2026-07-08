import { combineSignals } from "./abort";
import { CLIENT_TIMEOUT_MS, LLMProviderError } from "./errors";
import { stripToScript } from "./strip-to-script";
import { THE_SYSTEM_PROMPT } from "./system-prompt";
import type { LLMProvider } from "./types";

export interface OllamaProviderConfig {
  baseUrl: string;
  model: string;
}

interface OllamaChatResponse {
  message?: { role?: string; content?: string };
}

export class OllamaProvider implements LLMProvider {
  public readonly id = "ollama" as const;
  private readonly config: OllamaProviderConfig;

  constructor(config: OllamaProviderConfig) {
    this.config = config;
  }

  async generateVoxelScript(prompt: string, userSignal?: AbortSignal): Promise<string> {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    const endpoint = `${base}/api/chat`;

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), CLIENT_TIMEOUT_MS);
    const signal = combineSignals(timeoutController.signal, userSignal);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          stream: false,
          messages: [
            { role: "system", content: THE_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
        signal,
      });
    } catch (e) {
      if (userSignal?.aborted) {
        throw new LLMProviderError("ollama", "cancelled", undefined, "Cancelled by user");
      }
      if (timeoutController.signal.aborted) {
        throw new LLMProviderError(
          "ollama",
          "client-timeout",
          undefined,
          `Client timed out after ${CLIENT_TIMEOUT_MS}ms`,
        );
      }
      throw new LLMProviderError(
        "ollama",
        "network",
        undefined,
        e instanceof Error ? e.message : "Network error",
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new LLMProviderError(
        "ollama",
        "http",
        response.status,
        `Ollama returned HTTP ${response.status}`,
      );
    }

    let body: OllamaChatResponse;
    try {
      body = (await response.json()) as OllamaChatResponse;
    } catch {
      throw new LLMProviderError("ollama", "shape", undefined, "Ollama response was not JSON.");
    }

    const text = body.message?.content ?? "";
    return stripToScript("ollama", text);
  }
}
