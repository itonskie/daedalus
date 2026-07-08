import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

describe("Viewport error hint", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  test("shows `Last generation failed — showing previous scene.` after failure", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);
    expect(screen.queryByText(/Last generation failed/)).toBeNull();

    act(() => {
      // simulate a store failure signal
      // biome-ignore lint/suspicious/noExplicitAny: test needs to poke internal setter
      (getStore() as any).setState({ showLastFailedHint: true });
    });

    expect(screen.getByText("Last generation failed — showing previous scene.")).toBeTruthy();
  });

  test("hint clears when showLastFailedHint flips back to false (next success)", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);
    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test-only setter
      (getStore() as any).setState({ showLastFailedHint: true });
    });
    expect(screen.getByText(/Last generation failed/)).toBeTruthy();

    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test-only setter
      (getStore() as any).setState({ showLastFailedHint: false });
    });
    expect(screen.queryByText(/Last generation failed/)).toBeNull();
  });
});

describe("Code panel error banner", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  test("openCodePanel with errorCopy renders a danger banner with the copy", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);

    act(() => {
      getStore()
        .getState()
        .openCodePanel(
          "anthropic",
          'sphere(32, 20, 32, 8, "chartreuse")',
          "claude-sonnet-4-6",
          "The script used an unknown color: chartreuse.",
        );
    });

    const dialog = screen.getByRole("dialog");
    const banner = within(dialog).getByRole("alert");
    expect(banner.textContent).toBe("The script used an unknown color: chartreuse.");
    const body = within(dialog).getByTestId("code-panel__body");
    expect(body.textContent).toBe('sphere(32, 20, 32, 8, "chartreuse")');
  });

  test("openCodePanel without errorCopy does not render the banner", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);

    act(() => {
      getStore()
        .getState()
        .openCodePanel("anthropic", 'sphere(32, 20, 32, 8, "red")', "claude-sonnet-4-6");
    });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("alert")).toBeNull();
  });

  test("clicking `show code` on a syntax-error message opens panel with banner", async () => {
    const { getStore } = await mountApp();
    await screen.findByText(/Cached example/);

    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test-only setter to inject an error message
      (getStore() as any).setState({
        messages: [
          ...getStore().getState().messages,
          {
            id: "err-1",
            role: "assistant",
            text: "The generated script has a syntax error at line 4.",
            label: "Error",
            source: "anthropic",
            modelSlug: "claude-sonnet-4-6",
            script: "sphere(",
            errorKind: "syntax",
            errorCopy: "The generated script has a syntax error at line 4.",
          },
        ],
      });
    });

    const showCodeButtons = screen.getAllByRole("button", { name: /show code/i });
    fireEvent.click(showCodeButtons[showCodeButtons.length - 1]);

    const dialog = screen.getByRole("dialog");
    const banner = within(dialog).getByRole("alert");
    expect(banner.textContent).toBe("The generated script has a syntax error at line 4.");
    const body = within(dialog).getByTestId("code-panel__body");
    expect(body.textContent).toBe("sphere(");
  });
});
