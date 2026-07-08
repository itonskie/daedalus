import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDaedalusStore } from "./index";

describe("store actions", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  test("first-run initializes with the castle cached demo", async () => {
    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    const s = store.getState();
    expect(s.lastGoodGrid).not.toBeNull();
    expect(s.currentSource).toBe("cached");
    expect(s.messages[0].role).toBe("assistant");
    expect(s.messages[0].label).toContain("Cached example");
  });

  test("first-run default demo is castle with four towers", async () => {
    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    const s = store.getState();
    expect(s.currentPrompt).toBe("a small castle with four towers");
    expect(s.currentModelSlug).toBe("claude-sonnet-4-6");
  });

  test("loadCachedDemo swaps the grid and appends user + assistant messages", async () => {
    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    const before = store.getState().messages.length;
    const gridBefore = store.getState().lastGoodGrid;

    await store.getState().loadCachedDemo("red-sphere", "claude-sonnet-4-6");

    const s = store.getState();
    expect(s.messages.length).toBe(before + 2);
    expect(s.messages[before].role).toBe("user");
    expect(s.messages[before].text).toBe("a red sphere");
    expect(s.messages[before + 1].role).toBe("assistant");
    expect(s.messages[before + 1].label).toContain("Cached example");
    expect(s.currentPrompt).toBe("a red sphere");
    expect(s.currentSource).toBe("cached");
    expect(s.lastGoodGrid).not.toBe(gridBefore);
  });

  test("setProvider updates active provider", async () => {
    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    store.getState().setProvider("anthropic");
    expect(store.getState().activeProvider).toBe("anthropic");
  });

  test("cycleProvider cycles among configured providers only", async () => {
    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    // Only cached is configured — cycle is a no-op.
    store.getState().cycleProvider();
    expect(store.getState().activeProvider).toBe("cached");

    // Configure anthropic
    store.getState().setAnthropicKey("sk-ant-test");
    store.getState().cycleProvider();
    expect(store.getState().activeProvider).toBe("anthropic");

    // Cycle back to cached (ollama not configured)
    store.getState().cycleProvider();
    expect(store.getState().activeProvider).toBe("cached");
  });

  test("persists only provider config to localStorage", async () => {
    const store = createDaedalusStore({ persist: true });
    await store.getState().awaitInit();
    store.getState().setAnthropicKey("sk-ant-abc");
    store.getState().setAnthropicModel("claude-sonnet-4-6");

    const raw = localStorage.getItem("daedalus-mvp-v1");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.anthropicKey).toBe("sk-ant-abc");
    expect(parsed.state.anthropicModel).toBe("claude-sonnet-4-6");
    // Ephemeral state must not persist.
    expect(parsed.state.messages).toBeUndefined();
    expect(parsed.state.lastGoodGrid).toBeUndefined();
    expect(parsed.state.cameraA).toBeUndefined();
  });

  test("submitPrompt on cached provider loads default cached demo for slug", async () => {
    const store = createDaedalusStore({ persist: false });
    await store.getState().awaitInit();
    await store.getState().submitPrompt("a mushroom");
    const s = store.getState();
    expect(s.currentPrompt).toBe("a mushroom");
    expect(s.currentSource).toBe("cached");
  });
});
