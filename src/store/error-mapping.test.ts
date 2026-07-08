import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ExecuteError, ExecuteResult, Executor } from "../sandbox";
import { createDaedalusStore } from "./index";

const okAnthropic = (text: string) =>
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

class FakeExecutor implements Executor {
  private queue: ExecuteResult[] = [];

  constructor(initial?: ExecuteResult[]) {
    if (initial) this.queue.push(...initial);
  }

  enqueue(result: ExecuteResult): void {
    this.queue.push(result);
  }

  execute(_: string): Promise<ExecuteResult> {
    const next = this.queue.shift();
    if (next) return Promise.resolve(next);
    return Promise.resolve({
      ok: true,
      grid: {
        size: 64,
        cells: new Uint8Array(64 * 64 * 64),
        palette: [],
      } as unknown as ExecuteResult extends { ok: true; grid: infer G } ? G : never,
      durationMs: 0,
    } as ExecuteResult);
  }
}

const executeFailure = (error: ExecuteError): ExecuteResult => ({
  ok: false,
  error,
  durationMs: 0,
});

const configureAnthropic = (store: ReturnType<typeof createDaedalusStore>) => {
  store.getState().setAnthropicKey("sk-ant-xxx");
  store.getState().setProvider("anthropic");
};

const configureOllama = (store: ReturnType<typeof createDaedalusStore>) => {
  store.getState().setOllamaUrl("http://localhost:11434");
  store.getState().setOllamaModel("qwen3-coder:30b");
  store.getState().setProvider("ollama");
};

describe("Error taxonomy — end-to-end through submitPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("Anthropic 401 → exact copy, lastGoodGrid preserved, viewport hint on", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 401 })) as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    const gridBefore = store.getState().lastGoodGrid;
    configureAnthropic(store);

    await store.getState().submitPrompt("a red sphere");

    const s = store.getState();
    expect(s.messages.at(-1)?.text).toBe(
      "Anthropic rejected the request (401). Check your API key.",
    );
    expect(s.messages.at(-1)?.label).toBe("Error");
    expect(s.lastGoodGrid).toBe(gridBefore);
    expect(s.showLastFailedHint).toBe(true);
  });

  test("Anthropic 500 → exact copy", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 500 })) as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    configureAnthropic(store);

    await store.getState().submitPrompt("hi");

    const s = store.getState();
    expect(s.messages.at(-1)?.text).toBe(
      "Anthropic returned an error (500). Try again in a moment.",
    );
  });

  test("Ollama fetch rejects → exact copy including configured URL", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    configureOllama(store);
    const gridBefore = store.getState().lastGoodGrid;

    await store.getState().submitPrompt("hi");

    const s = store.getState();
    expect(s.messages.at(-1)?.text).toBe(
      "Could not reach Ollama at http://localhost:11434. Is it running?",
    );
    expect(s.lastGoodGrid).toBe(gridBefore);
  });

  test("Ollama 500 → exact copy", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 500 })) as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    configureOllama(store);

    await store.getState().submitPrompt("hi");

    const s = store.getState();
    expect(s.messages.at(-1)?.text).toBe("Ollama returned an error (500).");
  });

  test("Anthropic returns empty (non-code) → exact copy", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(okAnthropic("")) as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    configureAnthropic(store);

    await store.getState().submitPrompt("hi");

    const s = store.getState();
    expect(s.messages.at(-1)?.text).toBe("The model returned something that isn't code.");
  });

  test("Sandbox syntax error → exact copy and errorCopy on message", async () => {
    const executor = new FakeExecutor();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(okAnthropic('sphere(32,20,32,8,"red")')) as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false, executor });
    await store.getState().awaitInit();
    executor.enqueue(executeFailure({ kind: "syntax", message: "Unexpected token", line: 3 }));
    configureAnthropic(store);

    await store.getState().submitPrompt("a red sphere");

    const last = store.getState().messages.at(-1);
    expect(last?.text).toBe("The generated script has a syntax error at line 3.");
    expect(last?.errorCopy).toBe(last?.text);
    expect(last?.script).toBe('sphere(32,20,32,8,"red")');
  });

  test("Sandbox runtime throw → exact copy", async () => {
    const executor = new FakeExecutor();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(okAnthropic('place(0,0,0,"red")')) as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false, executor });
    await store.getState().awaitInit();
    executor.enqueue(
      executeFailure({ kind: "runtime", message: "boom", line: 5, errorType: "TypeError" }),
    );
    configureAnthropic(store);

    await store.getState().submitPrompt("a red sphere");

    expect(store.getState().messages.at(-1)?.text).toBe(
      "The generated script threw TypeError at line 5.",
    );
  });

  test("Sandbox timeout → exact copy", async () => {
    const executor = new FakeExecutor();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(okAnthropic("while(true){}")) as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false, executor });
    await store.getState().awaitInit();
    executor.enqueue(executeFailure({ kind: "timeout", message: "Script exceeded 3000ms" }));
    configureAnthropic(store);

    await store.getState().submitPrompt("infinite");

    expect(store.getState().messages.at(-1)?.text).toBe(
      "The generated script ran too long and was stopped.",
    );
  });

  test("Sandbox unknown color → exact copy including color name", async () => {
    const executor = new FakeExecutor();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(okAnthropic('place(0,0,0,"chartreuse")')) as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false, executor });
    await store.getState().awaitInit();
    executor.enqueue(
      executeFailure({
        kind: "unknown-color",
        message: "Unknown color: chartreuse",
        colorName: "chartreuse",
      }),
    );
    configureAnthropic(store);

    await store.getState().submitPrompt("a chartreuse cube");

    expect(store.getState().messages.at(-1)?.text).toBe(
      "The script used an unknown color: chartreuse.",
    );
  });

  test("Provider not configured → hint on submit, no fetch, no message appended", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setProvider("anthropic");

    const before = store.getState().messages.length;
    await store.getState().submitPrompt("hi");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.getState().providerNotConfiguredHint).toBe(true);
    expect(store.getState().messages.length).toBe(before);
  });

  test("Success after failure clears the viewport hint", async () => {
    const executor = new FakeExecutor();
    globalThis.fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(okAnthropic('sphere(32,20,32,8,"red")')),
      ) as unknown as typeof fetch;

    const store = createDaedalusStore({ persist: false, executor });
    await store.getState().awaitInit();
    executor.enqueue(executeFailure({ kind: "timeout", message: "..." }));
    configureAnthropic(store);

    await store.getState().submitPrompt("first");
    expect(store.getState().showLastFailedHint).toBe(true);

    // Second run: executor default is a successful (empty) grid.
    await store.getState().submitPrompt("second");
    expect(store.getState().showLastFailedHint).toBe(false);
  });

  test("lastGoodGrid is byte-identical (===) across every failure path", async () => {
    const executor = new FakeExecutor();
    const store = createDaedalusStore({ persist: false, executor });
    await store.getState().awaitInit();
    const gridBefore = store.getState().lastGoodGrid;
    executor.enqueue(executeFailure({ kind: "syntax", message: "...", line: 1 }));
    executor.enqueue(
      executeFailure({ kind: "runtime", message: "...", line: 1, errorType: "Error" }),
    );
    executor.enqueue(executeFailure({ kind: "timeout", message: "..." }));
    executor.enqueue(
      executeFailure({ kind: "unknown-color", message: "...", colorName: "chartreuse" }),
    );

    globalThis.fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(okAnthropic('place(0,0,0,"red")')),
      ) as unknown as typeof fetch;
    configureAnthropic(store);

    await store.getState().submitPrompt("a");
    expect(store.getState().lastGoodGrid).toBe(gridBefore);
    await store.getState().submitPrompt("b");
    expect(store.getState().lastGoodGrid).toBe(gridBefore);
    await store.getState().submitPrompt("c");
    expect(store.getState().lastGoodGrid).toBe(gridBefore);
    await store.getState().submitPrompt("d");
    expect(store.getState().lastGoodGrid).toBe(gridBefore);
  });
});
