import type { LLMProviderId } from "./errors";

export interface LLMProvider {
  readonly id: LLMProviderId;
  generateVoxelScript(prompt: string): Promise<string>;
}
