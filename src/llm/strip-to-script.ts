import { LLMProviderError, type LLMProviderId } from "./errors";

const FENCE_RE = /```(?:javascript|js)?\s*\n([\s\S]*?)```/i;

export function stripToScript(providerId: LLMProviderId, raw: string): string {
  const fenced = raw.match(FENCE_RE);
  const body = fenced ? fenced[1] : raw;
  const trimmed = body.trim();
  if (!trimmed) {
    throw new LLMProviderError(
      providerId,
      "shape",
      undefined,
      "The model returned something that isn't code.",
    );
  }
  return trimmed;
}
