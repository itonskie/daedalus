import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LLMProviderError } from "../llm";
import { createDaedalusStore } from "./index";

const okResponse = (text: string) =>
  new Response(
    JSON.stringify({
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-6",
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
    }),
    { status: 200 },
  );

describe("submitPrompt on Anthropic", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("empty key: shows provider-not-configured hint and does not call fetch", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setProvider("anthropic");

    await store.getState().submitPrompt("a red sphere");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.getState().providerNotConfiguredHint).toBe(true);
  });

  test("provider hint clears when user types in the input (clearProviderNotConfiguredHint)", async () => {
    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setProvider("anthropic");
    await store.getState().submitPrompt("hi");
    expect(store.getState().providerNotConfiguredHint).toBe(true);
    store.getState().clearProviderNotConfiguredHint();
    expect(store.getState().providerNotConfiguredHint).toBe(false);
  });

  test("configured key + Anthropic: fires exactly one POST to /v1/messages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse('```javascript\nsphere(32,20,32,8,"red")\n```'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setAnthropicKey("sk-ant-xxx");
    store.getState().setProvider("anthropic");

    await store.getState().submitPrompt("a red sphere");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
  });

  test("success: updates lastGoodGrid, appends assistant message labeled 'Anthropic · <model>'", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse('```javascript\nsphere(32,20,32,8,"red")\n```'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    const gridBefore = store.getState().lastGoodGrid;
    store.getState().setAnthropicKey("sk-ant-xxx");
    store.getState().setProvider("anthropic");

    const beforeCount = store.getState().messages.length;
    await store.getState().submitPrompt("a red sphere");

    const s = store.getState();
    expect(s.messages.length).toBe(beforeCount + 2);
    expect(s.messages[beforeCount].role).toBe("user");
    expect(s.messages[beforeCount].text).toBe("a red sphere");
    expect(s.messages[beforeCount + 1].role).toBe("assistant");
    expect(s.messages[beforeCount + 1].label).toBe("Anthropic · claude-sonnet-4-6");
    expect(s.messages[beforeCount + 1].source).toBe("anthropic");
    expect(s.currentSource).toBe("anthropic");
    expect(s.currentModelSlug).toBe("claude-sonnet-4-6");
    expect(s.lastGoodGrid).not.toBe(gridBefore);
    expect(s.isGenerating).toBe(false);
  });

  test("HTTP failure: preserves lastGoodGrid and appends assistant error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setAnthropicKey("sk-ant-xxx");
    store.getState().setProvider("anthropic");
    const gridBefore = store.getState().lastGoodGrid;

    await store.getState().submitPrompt("hi");

    const s = store.getState();
    expect(s.lastGoodGrid).toBe(gridBefore);
    expect(s.isGenerating).toBe(false);
    const last = s.messages[s.messages.length - 1];
    expect(last.role).toBe("assistant");
    expect(last.label).toBe("Error");
  });

  test("network failure: preserves lastGoodGrid, LLMProviderError kind=network is stored", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setAnthropicKey("sk-ant-xxx");
    store.getState().setProvider("anthropic");
    const gridBefore = store.getState().lastGoodGrid;

    await store.getState().submitPrompt("hi");

    const s = store.getState();
    expect(s.lastGoodGrid).toBe(gridBefore);
    expect(s.lastError).toBeInstanceOf(LLMProviderError);
    expect((s.lastError as LLMProviderError).kind).toBe("network");
  });

  test("isGenerating flips true during in-flight generation and back to false", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const inflight = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(inflight);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setAnthropicKey("sk-ant-xxx");
    store.getState().setProvider("anthropic");

    const submitPromise = store.getState().submitPrompt("hi");
    await Promise.resolve();
    expect(store.getState().isGenerating).toBe(true);

    resolveFetch(okResponse('place(0,0,0,"red")'));
    await submitPromise;

    expect(store.getState().isGenerating).toBe(false);
  });
});
