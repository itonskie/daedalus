import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LLMProviderError } from "../llm";
import { createDaedalusStore } from "./index";

const okResponse = (content: string) =>
  new Response(
    JSON.stringify({
      model: "qwen3-coder:30b",
      created_at: "2026-07-08T15:04:05Z",
      message: { role: "assistant", content },
      done: true,
    }),
    { status: 200 },
  );

describe("submitPrompt on Ollama", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("empty URL: shows provider-not-configured hint and does not call fetch", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setProvider("ollama");

    await store.getState().submitPrompt("a red sphere");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.getState().providerNotConfiguredHint).toBe(true);
  });

  test("configured URL + Ollama: fires exactly one POST to <url>/api/chat with exact body from api-contracts §5", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('sphere(32,24,32,8,"red")'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setOllamaUrl("http://localhost:11434");
    store.getState().setOllamaModel("qwen3-coder:30b");
    store.getState().setProvider("ollama");

    await store.getState().submitPrompt("a red sphere");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(init.body as string);
    expect(body.stream).toBe(false);
    expect(body.model).toBe("qwen3-coder:30b");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1]).toEqual({ role: "user", content: "a red sphere" });
  });

  test("success: assistant message labeled 'Ollama · <model>'", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('sphere(32,20,32,8,"red")'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setOllamaUrl("http://localhost:11434");
    store.getState().setOllamaModel("qwen3-coder:30b");
    store.getState().setProvider("ollama");

    const before = store.getState().messages.length;
    await store.getState().submitPrompt("a red sphere");

    const s = store.getState();
    expect(s.messages[before].role).toBe("user");
    expect(s.messages[before + 1].role).toBe("assistant");
    expect(s.messages[before + 1].label).toBe("Ollama · qwen3-coder:30b");
    expect(s.messages[before + 1].source).toBe("ollama");
    expect(s.currentSource).toBe("ollama");
    expect(s.currentModelSlug).toBe("qwen3-coder:30b");
  });

  test("network failure: preserves lastGoodGrid and stores LLMProviderError kind=network", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setOllamaUrl("http://localhost:11434");
    store.getState().setOllamaModel("qwen3-coder:30b");
    store.getState().setProvider("ollama");
    const gridBefore = store.getState().lastGoodGrid;

    await store.getState().submitPrompt("hi");

    const s = store.getState();
    expect(s.lastGoodGrid).toBe(gridBefore);
    expect(s.lastError).toBeInstanceOf(LLMProviderError);
    expect((s.lastError as LLMProviderError).kind).toBe("network");
    expect(s.messages[s.messages.length - 1].label).toBe("Error");
  });

  test("cycleProvider treats Ollama as configured when URL is non-empty", async () => {
    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();

    // Cached only — no cycling.
    store.getState().cycleProvider();
    expect(store.getState().activeProvider).toBe("cached");

    // URL set but model empty: still counts as configured per the ticket.
    store.getState().setOllamaUrl("http://localhost:11434");
    store.getState().cycleProvider();
    expect(store.getState().activeProvider).toBe("ollama");

    store.getState().cycleProvider();
    expect(store.getState().activeProvider).toBe("cached");
  });

  test("cycleProvider cycles Cached → Anthropic → Ollama → Cached when all three configured", async () => {
    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setAnthropicKey("sk-ant-test");
    store.getState().setOllamaUrl("http://localhost:11434");
    store.getState().setOllamaModel("qwen3-coder:30b");

    expect(store.getState().activeProvider).toBe("cached");
    store.getState().cycleProvider();
    expect(store.getState().activeProvider).toBe("anthropic");
    store.getState().cycleProvider();
    expect(store.getState().activeProvider).toBe("ollama");
    store.getState().cycleProvider();
    expect(store.getState().activeProvider).toBe("cached");
  });

  test("persistence key contains ollamaUrl and ollamaModel", async () => {
    const store = createDaedalusStore({ persist: true });
    await store.getState().awaitInit();
    store.getState().setOllamaUrl("http://localhost:11434");
    store.getState().setOllamaModel("qwen3-coder:30b");

    const raw = localStorage.getItem("daedalus-mvp-v1");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.ollamaUrl).toBe("http://localhost:11434");
    expect(parsed.state.ollamaModel).toBe("qwen3-coder:30b");
  });
});
