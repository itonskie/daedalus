import { describe, expect, test } from "vitest";
import { LLMProviderError } from "../llm";
import type { ExecuteError } from "../sandbox";
import { PROVIDER_NOT_CONFIGURED_COPY, errorToCopy } from "./error-copy";

describe("errorToCopy — LLMProviderError rows", () => {
  test("Anthropic HTTP 4xx", () => {
    const err = new LLMProviderError("anthropic", "http", 401);
    expect(errorToCopy(err)).toBe("Anthropic rejected the request (401). Check your API key.");
  });

  test("Anthropic HTTP 5xx", () => {
    const err = new LLMProviderError("anthropic", "http", 500);
    expect(errorToCopy(err)).toBe("Anthropic returned an error (500). Try again in a moment.");
  });

  test("Anthropic shape (non-code)", () => {
    const err = new LLMProviderError("anthropic", "shape");
    expect(errorToCopy(err)).toBe("The model returned something that isn't code.");
  });

  test("Ollama network — copy includes the configured URL", () => {
    const err = new LLMProviderError("ollama", "network");
    expect(errorToCopy(err, { ollamaUrl: "http://localhost:11434" })).toBe(
      "Could not reach Ollama at http://localhost:11434. Is it running?",
    );
  });

  test("Ollama HTTP error", () => {
    const err = new LLMProviderError("ollama", "http", 500);
    expect(errorToCopy(err)).toBe("Ollama returned an error (500).");
  });

  test("Ollama shape (non-code)", () => {
    const err = new LLMProviderError("ollama", "shape");
    expect(errorToCopy(err)).toBe("The model returned something that isn't code.");
  });

  test("cancelled (Anthropic)", () => {
    const err = new LLMProviderError("anthropic", "cancelled");
    expect(errorToCopy(err)).toBe("Generation cancelled.");
  });

  test("cancelled (Ollama)", () => {
    const err = new LLMProviderError("ollama", "cancelled");
    expect(errorToCopy(err)).toBe("Generation cancelled.");
  });

  test("client-timeout (Anthropic)", () => {
    const err = new LLMProviderError("anthropic", "client-timeout");
    expect(errorToCopy(err)).toBe("The model took too long — try again or use a smaller model.");
  });

  test("client-timeout (Ollama)", () => {
    const err = new LLMProviderError("ollama", "client-timeout");
    expect(errorToCopy(err)).toBe("The model took too long — try again or use a smaller model.");
  });
});

describe("errorToCopy — ExecuteError rows", () => {
  test("syntax error at line n", () => {
    const err: ExecuteError = { kind: "syntax", message: "…", line: 3 };
    expect(errorToCopy(err)).toBe("The generated script has a syntax error at line 3.");
  });

  test("runtime throw at line n with error type", () => {
    const err: ExecuteError = {
      kind: "runtime",
      message: "boom",
      line: 5,
      errorType: "TypeError",
    };
    expect(errorToCopy(err)).toBe("The generated script threw TypeError at line 5.");
  });

  test("timeout", () => {
    const err: ExecuteError = { kind: "timeout", message: "…" };
    expect(errorToCopy(err)).toBe("The generated script ran too long and was stopped.");
  });

  test("unknown color includes the color name", () => {
    const err: ExecuteError = {
      kind: "unknown-color",
      message: "…",
      colorName: "chartreuse",
    };
    expect(errorToCopy(err)).toBe("The script used an unknown color: chartreuse.");
  });
});

describe("PROVIDER_NOT_CONFIGURED_COPY", () => {
  test("exact taxonomy copy", () => {
    expect(PROVIDER_NOT_CONFIGURED_COPY).toBe("Add a provider in settings to run live prompts.");
  });
});
