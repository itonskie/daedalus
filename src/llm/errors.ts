export type LLMProviderErrorKind = "http" | "network" | "shape";

export type LLMProviderId = "anthropic" | "ollama";

export class LLMProviderError extends Error {
  public readonly providerId: LLMProviderId;
  public readonly kind: LLMProviderErrorKind;
  public readonly status?: number;

  constructor(
    providerId: LLMProviderId,
    kind: LLMProviderErrorKind,
    status?: number,
    message?: string,
  ) {
    super(message ?? `${providerId} provider error (${kind})`);
    this.name = "LLMProviderError";
    this.providerId = providerId;
    this.kind = kind;
    this.status = status;
  }
}
