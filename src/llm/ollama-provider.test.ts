import { afterEach, describe, expect, test, vi } from "vitest";
import { LLMProviderError } from "./errors";
import { OllamaProvider } from "./ollama-provider";
import { THE_SYSTEM_PROMPT } from "./system-prompt";

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

describe("OllamaProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("id is 'ollama'", () => {
    const p = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "qwen3-coder:30b" });
    expect(p.id).toBe("ollama");
  });

  test("posts to the configured URL with the exact chat body from api-contracts §5", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('sphere(32,24,32,8,"red")'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "qwen3-coder:30b" });
    const script = await p.generateVoxelScript("a red sphere");

    expect(script).toBe('sphere(32,24,32,8,"red")');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/chat");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"] ?? headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body.stream).toBe(false);
    expect(body.model).toBe("qwen3-coder:30b");
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages[0]).toEqual({ role: "system", content: THE_SYSTEM_PROMPT });
    expect(body.messages[1]).toEqual({ role: "user", content: "a red sphere" });
  });

  test("strips markdown fences from the response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse('```javascript\nplace(0,0,0,"red")\n```'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "qwen3-coder:30b" });
    const script = await p.generateVoxelScript("a red dot");
    expect(script).toBe('place(0,0,0,"red")');
  });

  test("trailing slash in baseUrl is tolerated", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('place(0,0,0,"red")'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new OllamaProvider({ baseUrl: "http://localhost:11434/", model: "qwen3-coder:30b" });
    await p.generateVoxelScript("a red dot");
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/chat");
  });

  test("HTTP error throws LLMProviderError(kind:'http', status)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "qwen3-coder:30b" });
    await expect(p.generateVoxelScript("hi")).rejects.toMatchObject({
      providerId: "ollama",
      kind: "http",
      status: 500,
    });
  });

  test("network failure (fetch rejects) throws LLMProviderError(kind:'network')", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "qwen3-coder:30b" });
    await expect(p.generateVoxelScript("hi")).rejects.toBeInstanceOf(LLMProviderError);
    await expect(p.generateVoxelScript("hi")).rejects.toMatchObject({
      providerId: "ollama",
      kind: "network",
    });
  });

  test("empty content throws LLMProviderError(kind:'shape')", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse("   \n"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "qwen3-coder:30b" });
    await expect(p.generateVoxelScript("hi")).rejects.toMatchObject({
      providerId: "ollama",
      kind: "shape",
    });
  });

  test("uses the configured model in the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('place(0,0,0,"red")'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "qwen2.5-coder:14b" });
    await p.generateVoxelScript("a red dot");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("qwen2.5-coder:14b");
  });

  test("does not enable streaming (no stream:true in body)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('place(0,0,0,"red")'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "qwen3-coder:30b" });
    await p.generateVoxelScript("a red dot");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.stream).toBe(false);
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

    const p = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "qwen3-coder:30b" });
    const abort = new AbortController();
    const promise = p.generateVoxelScript("a sphere", abort.signal);
    await Promise.resolve();
    abort.abort();
    await expect(promise).rejects.toMatchObject({
      providerId: "ollama",
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

      const p = new OllamaProvider({ baseUrl: "http://localhost:11434", model: "qwen3-coder:30b" });
      const promise = p.generateVoxelScript("a sphere");
      const caught = promise.catch((e) => e);
      await vi.advanceTimersByTimeAsync(120_000);
      const err = await caught;
      expect(err).toMatchObject({ providerId: "ollama", kind: "client-timeout" });
    } finally {
      vi.useRealTimers();
    }
  });
});
