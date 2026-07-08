import { LLMProviderError } from "../llm";
import type { ExecuteError } from "../sandbox";

export const PROVIDER_NOT_CONFIGURED_COPY = "Add a provider in settings to run live prompts.";

export const VIEWPORT_FAILED_HINT = "Last generation failed — showing previous scene.";

export interface ErrorCopyContext {
  ollamaUrl?: string;
}

export function errorToCopy(
  err: LLMProviderError | ExecuteError,
  ctx: ErrorCopyContext = {},
): string {
  if (err instanceof LLMProviderError) return llmErrorToCopy(err, ctx);
  return executeErrorToCopy(err);
}

function llmErrorToCopy(err: LLMProviderError, ctx: ErrorCopyContext): string {
  if (err.kind === "shape") return "The model returned something that isn't code.";
  if (err.kind === "cancelled") return "Generation cancelled.";
  if (err.kind === "client-timeout") {
    return "The model took too long — try again or use a smaller model.";
  }

  if (err.providerId === "anthropic") {
    const status = err.status ?? 0;
    if (err.kind === "http" && status >= 400 && status < 500) {
      return `Anthropic rejected the request (${status}). Check your API key.`;
    }
    if (err.kind === "http") {
      return `Anthropic returned an error (${status}). Try again in a moment.`;
    }
    return "Anthropic returned an error. Try again in a moment.";
  }

  if (err.kind === "network") {
    const url = ctx.ollamaUrl ?? "";
    return `Could not reach Ollama at ${url}. Is it running?`;
  }
  return `Ollama returned an error (${err.status ?? "error"}).`;
}

function executeErrorToCopy(err: ExecuteError): string {
  if (err.kind === "syntax") {
    const line = err.line ?? "unknown";
    return `The generated script has a syntax error at line ${line}.`;
  }
  if (err.kind === "runtime") {
    const line = err.line ?? "unknown";
    return `The generated script threw ${err.errorType} at line ${line}.`;
  }
  if (err.kind === "timeout") {
    return "The generated script ran too long and was stopped.";
  }
  return `The script used an unknown color: ${err.colorName}.`;
}
