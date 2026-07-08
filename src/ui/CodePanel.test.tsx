import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../renderer", () => ({
  ViewportCanvas: () => <div data-testid="viewport-canvas" />,
}));

async function loadApp() {
  vi.resetModules();
  const { App } = await import("./App");
  const { getStore } = await import("../store/react");
  return { App, getStore };
}

async function mountApp() {
  const { App, getStore } = await loadApp();
  const utils = render(<App />);
  await getStore().getState().awaitInit();
  return { ...utils, getStore };
}

describe("CodePanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  test("show code opens the panel with the current script", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);

    fireEvent.click(screen.getByRole("button", { name: /show code/i }));

    const dialog = screen.getByRole("dialog", { name: /generated script/i });
    expect(dialog).toBeTruthy();
    const body = within(dialog).getByTestId("code-panel__body");
    expect(body.textContent).toBe(getStore().getState().currentScript);
  });

  test("header reads Cached · <model-slug> for cached first-run", async () => {
    await mountApp();
    await screen.findByText(/Cached example/);
    fireEvent.click(screen.getByRole("button", { name: /show code/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/Cached · claude-sonnet-4-6/);
  });

  test("× button closes the panel", async () => {
    await mountApp();
    await screen.findByText(/Cached example/);
    fireEvent.click(screen.getByRole("button", { name: /show code/i }));
    fireEvent.click(screen.getByRole("button", { name: /close code panel/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Escape closes the panel", async () => {
    await mountApp();
    await screen.findByText(/Cached example/);
    fireEvent.click(screen.getByRole("button", { name: /show code/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("clicking the viewport region closes the panel", async () => {
    await mountApp();
    await screen.findByText(/Cached example/);
    fireEvent.click(screen.getByRole("button", { name: /show code/i }));
    fireEvent.click(screen.getByTestId("viewport-canvas"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("persistent View code link visible when a script is loaded", async () => {
    await mountApp();
    await screen.findByText(/Cached example/);
    expect(screen.getByRole("button", { name: /view code/i })).toBeTruthy();
  });

  test("focus moves to close button on open, returns to opener on close", async () => {
    await mountApp();
    await screen.findByText(/Cached example/);
    const showCodeButton = screen.getByRole("button", { name: /show code/i });
    showCodeButton.focus();
    fireEvent.click(showCodeButton);
    const closeButton = screen.getByRole("button", { name: /close code panel/i });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.click(closeButton);
    expect(document.activeElement).toBe(showCodeButton);
  });

  test("header reads Anthropic · <model> for a live Anthropic generation", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);

    act(() => {
      getStore()
        .getState()
        .openCodePanel("anthropic", 'sphere(32, 24, 32, 8, "red")', "claude-sonnet-4-6");
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/Anthropic · claude-sonnet-4-6/);
    const body = within(dialog).getByTestId("code-panel__body");
    expect(body.textContent).toBe('sphere(32, 24, 32, 8, "red")');
  });

  test("header reads Ollama · <model> for a live Ollama generation", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);

    act(() => {
      getStore()
        .getState()
        .openCodePanel("ollama", 'box(0, 0, 0, 4, 4, 4, "stone")', "qwen3-coder:30b");
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/Ollama · qwen3-coder:30b/);
  });

  test("Copy writes the script to clipboard and label swaps to Copied then reverts", async () => {
    let clipboardText = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async (t: string) => {
          clipboardText = t;
        }),
        readText: vi.fn(async () => clipboardText),
      },
    });

    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);
    fireEvent.click(screen.getByRole("button", { name: /show code/i }));

    const dialog = screen.getByRole("dialog");
    const copyBtn = within(dialog).getByRole("button", { name: /^copy$/i });

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      fireEvent.click(copyBtn);

      await Promise.resolve();
      await Promise.resolve();

      expect(clipboardText).toBe(getStore().getState().currentScript);
      expect(within(dialog).getByRole("button", { name: /^copied$/i })).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(801);
      });
      expect(within(dialog).getByRole("button", { name: /^copy$/i })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
