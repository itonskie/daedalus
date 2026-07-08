import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { LLMProvider } from "../llm";
import { LLMProviderError } from "../llm";
import { createDaedalusStore } from "./index";

function hangingProvider(): { provider: LLMProvider; lastSignal: () => AbortSignal | undefined } {
  let capturedSignal: AbortSignal | undefined;
  const provider: LLMProvider = {
    id: "anthropic",
    generateVoxelScript(_prompt: string, signal?: AbortSignal) {
      capturedSignal = signal;
      return new Promise<string>((_resolve, reject) => {
        if (!signal) return;
        signal.addEventListener("abort", () => {
          reject(new LLMProviderError("anthropic", "cancelled", undefined, "Cancelled by user"));
        });
      });
    },
  };
  return { provider, lastSignal: () => capturedSignal };
}

describe("cancelGeneration action", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("cancel while a live generation is in flight surfaces the cancelled copy", async () => {
    const { provider, lastSignal } = hangingProvider();
    const store = createDaedalusStore({
      persist: false,
      liveProviderFactory: () => provider,
    });
    await store.getState().awaitInit();
    const gridBefore = store.getState().lastGoodGrid;
    store.getState().setAnthropicKey("sk-ant-xxx");
    store.getState().setProvider("anthropic");

    const submitPromise = store.getState().submitPrompt("a red sphere");
    await Promise.resolve();
    await Promise.resolve();

    expect(store.getState().isGenerating).toBe(true);
    expect(lastSignal()).toBeInstanceOf(AbortSignal);

    store.getState().cancelGeneration();

    await submitPromise;

    const s = store.getState();
    expect(s.isGenerating).toBe(false);
    expect(s.lastGoodGrid).toBe(gridBefore);
    const last = s.messages.at(-1);
    expect(last?.role).toBe("assistant");
    expect(last?.label).toBe("Error");
    expect(last?.text).toBe("Generation cancelled.");
    expect(last?.errorKind).toBe("provider");
  });

  test("cancelGeneration is a no-op when nothing is in flight", async () => {
    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    const messagesBefore = store.getState().messages.length;

    store.getState().cancelGeneration();

    const s = store.getState();
    expect(s.isGenerating).toBe(false);
    expect(s.messages.length).toBe(messagesBefore);
  });
});
