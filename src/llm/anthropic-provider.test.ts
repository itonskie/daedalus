import { afterEach, describe, expect, test, vi } from "vitest";
import { AnthropicProvider } from "./anthropic-provider";
import { LLMProviderError } from "./errors";
import { THE_SYSTEM_PROMPT } from "./system-prompt";

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

describe("AnthropicProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("id is 'anthropic'", () => {
    const p = new AnthropicProvider({ apiKey: "sk-ant-xxx", model: "claude-sonnet-4-6" });
    expect(p.id).toBe("anthropic");
  });

  test("sends the exact request shape from api-contracts §4 and returns the stripped script", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse('```javascript\nsphere(32,24,32,8,"red")\n```'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new AnthropicProvider({ apiKey: "sk-ant-xxx", model: "claude-sonnet-4-6" });
    const script = await p.generateVoxelScript("a red sphere");

    expect(script).toBe('sphere(32,24,32,8,"red")');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-xxx");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(headers["content-type"] ?? headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: "a red sphere" }],
    });
    expect(body.system).toBe(THE_SYSTEM_PROMPT);
  });

  test("HTTP 4xx throws LLMProviderError(kind:'http', status)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new AnthropicProvider({ apiKey: "sk-ant-xxx", model: "claude-sonnet-4-6" });
    await expect(p.generateVoxelScript("hi")).rejects.toMatchObject({
      providerId: "anthropic",
      kind: "http",
      status: 401,
    });
  });

  test("HTTP 5xx throws LLMProviderError(kind:'http', status)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new AnthropicProvider({ apiKey: "sk-ant-xxx", model: "claude-sonnet-4-6" });
    await expect(p.generateVoxelScript("hi")).rejects.toMatchObject({
      providerId: "anthropic",
      kind: "http",
      status: 500,
    });
  });

  test("network failure (fetch rejects) throws LLMProviderError(kind:'network')", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new AnthropicProvider({ apiKey: "sk-ant-xxx", model: "claude-sonnet-4-6" });
    await expect(p.generateVoxelScript("hi")).rejects.toBeInstanceOf(LLMProviderError);
    await expect(p.generateVoxelScript("hi")).rejects.toMatchObject({
      providerId: "anthropic",
      kind: "network",
    });
  });

  test("empty content throws LLMProviderError(kind:'shape')", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse("   \n"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new AnthropicProvider({ apiKey: "sk-ant-xxx", model: "claude-sonnet-4-6" });
    await expect(p.generateVoxelScript("hi")).rejects.toMatchObject({
      providerId: "anthropic",
      kind: "shape",
    });
  });

  test("uses the configured model in the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('place(0,0,0,"red")'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new AnthropicProvider({ apiKey: "sk-ant-xxx", model: "claude-haiku-4-5" });
    await p.generateVoxelScript("a red dot");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("claude-haiku-4-5");
  });

  test("forwards the AbortSignal into fetch and rejects with kind: cancelled", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The user aborted a request.", "AbortError"));
        });
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new AnthropicProvider({ apiKey: "sk-ant-xxx", model: "claude-sonnet-4-6" });
    const abort = new AbortController();
    const promise = p.generateVoxelScript("a sphere", abort.signal);
    await Promise.resolve();
    abort.abort();
    await expect(promise).rejects.toMatchObject({
      providerId: "anthropic",
      kind: "cancelled",
    });
  });

  test("self-aborts after the client timeout and rejects with kind: client-timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The user aborted a request.", "AbortError"));
          });
        });
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const p = new AnthropicProvider({ apiKey: "sk-ant-xxx", model: "claude-sonnet-4-6" });
      const promise = p.generateVoxelScript("a sphere");
      // Avoid unhandled-rejection warnings while timers advance.
      const caught = promise.catch((e) => e);
      await vi.advanceTimersByTimeAsync(120_000);
      const err = await caught;
      expect(err).toMatchObject({ providerId: "anthropic", kind: "client-timeout" });
    } finally {
      vi.useRealTimers();
    }
  });
});
