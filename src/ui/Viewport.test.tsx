import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../renderer", () => ({
  ViewportCanvas: () => <div data-testid="viewport-canvas" />,
}));

async function mountApp() {
  vi.resetModules();
  const { App } = await import("./App");
  const { getStore } = await import("../store/react");
  const utils = render(<App />);
  await getStore().getState().awaitInit();
  return { ...utils, getStore };
}

function getGeneratingText(): string {
  return screen.getByTestId("viewport-generating").textContent ?? "";
}

describe("Viewport generating state", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("shows `Generating… Ns` counter that ticks every second", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);

    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test-only setter
      (getStore() as any).setState({ isGenerating: true });
    });

    expect(getGeneratingText()).toMatch(/Generating…/);
    expect(getGeneratingText()).toContain("0s");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(getGeneratingText()).toContain("1s");

    act(() => {
      vi.advanceTimersByTime(11_000);
    });
    expect(getGeneratingText()).toContain("12s");
  });

  test("shows a Cancel button that calls cancelGeneration and is keyboard-focusable", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);

    const cancelSpy = vi.fn();
    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test-only setter
      (getStore() as any).setState({ isGenerating: true, cancelGeneration: cancelSpy });
    });

    const cancel = screen.getByRole("button", { name: /^Cancel$/ });
    expect(cancel.tagName.toLowerCase()).toBe("button");
    expect(cancel.hasAttribute("disabled")).toBe(false);

    fireEvent.click(cancel);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  test("hint escalates at 15s and 60s", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);

    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test-only setter
      (getStore() as any).setState({ isGenerating: true });
    });

    // 0–15s: no extra hint yet.
    expect(getGeneratingText()).not.toMatch(/First request warms the model/);
    expect(getGeneratingText()).not.toMatch(/Taking longer than usual/);

    // Cross 15s boundary.
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(getGeneratingText()).toMatch(/First request warms the model\./);
    expect(getGeneratingText()).not.toMatch(/Taking longer than usual/);

    // Cross 60s boundary.
    act(() => {
      vi.advanceTimersByTime(45_000);
    });
    expect(getGeneratingText()).not.toMatch(/First request warms the model/);
    expect(getGeneratingText()).toMatch(/Taking longer than usual\./);
  });

  test("counter resets to 0s on next generation", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);

    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test-only setter
      (getStore() as any).setState({ isGenerating: true });
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(getGeneratingText()).toContain("5s");

    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test-only setter
      (getStore() as any).setState({ isGenerating: false });
    });
    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test-only setter
      (getStore() as any).setState({ isGenerating: true });
    });
    expect(getGeneratingText()).toContain("0s");
  });
});
