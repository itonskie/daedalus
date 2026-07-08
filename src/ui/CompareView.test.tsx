import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  missingModel: null as string | null,
}));

vi.mock("../renderer", () => ({
  ViewportCanvas: ({
    grid,
    cameraState,
  }: {
    grid: { cells: Uint8Array } | null;
    cameraState?: { position: [number, number, number]; target: [number, number, number] } | null;
  }) => {
    let occupied = 0;
    if (grid?.cells) {
      const cells = grid.cells;
      for (let i = 0; i < cells.length; i++) if (cells[i] !== 0) occupied++;
    }
    return (
      <div
        data-testid="voxel-instanced-mesh"
        data-instance-count={occupied}
        data-camera-position={cameraState ? cameraState.position.join(",") : ""}
        data-camera-target={cameraState ? cameraState.target.join(",") : ""}
      />
    );
  },
}));

vi.mock("../demos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../demos")>();
  return {
    ...actual,
    getCachedScript: (promptSlug: string, modelSlug: string) => {
      if (stubs.missingModel === modelSlug) return null;
      return actual.getCachedScript(promptSlug, modelSlug);
    },
  };
});

async function mount() {
  vi.resetModules();
  const react = await import("../store/react");
  react.__resetStoreForTesting();
  const { CompareView } = await import("./CompareView");
  const utils = render(<CompareView />);
  const store = react.getStore();
  await store.getState().awaitInit();
  return { ...utils, store };
}

async function settleExecutor() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
}

describe("CompareView", () => {
  beforeEach(() => {
    localStorage.clear();
    stubs.missingModel = null;
  });
  afterEach(() => {
    cleanup();
  });

  test("both viewports render the cached demos for the default (red-sphere) prompt", async () => {
    await mount();
    await settleExecutor();
    const meshes = screen.getAllByTestId("voxel-instanced-mesh");
    expect(meshes).toHaveLength(2);
    expect(Number(meshes[0].getAttribute("data-instance-count"))).toBeGreaterThan(0);
    expect(Number(meshes[1].getAttribute("data-instance-count"))).toBeGreaterThan(0);
  });

  test("prompt selector defaults to the first canonical prompt", async () => {
    await mount();
    const select = screen.getByRole("combobox", { name: /prompt/i }) as HTMLSelectElement;
    expect(select.value).toBe("red-sphere");
  });

  test("changing the prompt swaps both viewport grids; model slugs still shown", async () => {
    await mount();
    await settleExecutor();
    const meshesBefore = screen.getAllByTestId("voxel-instanced-mesh");
    const countsBefore = meshesBefore.map((m) => m.getAttribute("data-instance-count"));

    fireEvent.change(screen.getByRole("combobox", { name: /prompt/i }), {
      target: { value: "castle-with-four-towers" },
    });
    await settleExecutor();

    const meshesAfter = screen.getAllByTestId("voxel-instanced-mesh");
    const countsAfter = meshesAfter.map((m) => m.getAttribute("data-instance-count"));
    // Both grids should have changed (castle is larger than red-sphere)
    expect(countsAfter[0]).not.toBe(countsBefore[0]);
    expect(countsAfter[1]).not.toBe(countsBefore[1]);
    expect(screen.getByText("claude-sonnet-4-6")).toBeTruthy();
    expect(screen.getByText("qwen3-coder-30b")).toBeTruthy();
  });

  test("setCameraCompare updates both viewport cameraState props", async () => {
    const { store } = await mount();
    await settleExecutor();
    act(() => {
      store.getState().setCameraCompare({
        position: [10, 10, 10],
        target: [32, 20, 32],
      });
    });
    const meshes = screen.getAllByTestId("voxel-instanced-mesh");
    expect(meshes[0].getAttribute("data-camera-position")).toBe("10,10,10");
    expect(meshes[1].getAttribute("data-camera-position")).toBe("10,10,10");
    expect(meshes[0].getAttribute("data-camera-target")).toBe("32,20,32");
    expect(meshes[1].getAttribute("data-camera-target")).toBe("32,20,32");
  });

  test("show code (side A) opens code panel with claude-sonnet-4-6 script and Cached source", async () => {
    const { store } = await mount();
    await settleExecutor();
    const buttons = screen.getAllByRole("button", { name: /show code/i });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    const s = store.getState();
    expect(s.isCodePanelOpen).toBe(true);
    expect(s.codePanelSource).toBe("cached");
    expect(s.codePanelModelSlug).toBe("claude-sonnet-4-6");
    expect(typeof s.codePanelScript).toBe("string");
    expect((s.codePanelScript as string).length).toBeGreaterThan(0);
  });

  test("show code (side B) opens code panel with qwen3-coder-30b script", async () => {
    const { store } = await mount();
    await settleExecutor();
    const buttons = screen.getAllByRole("button", { name: /show code/i });
    fireEvent.click(buttons[1]);
    const s = store.getState();
    expect(s.codePanelSource).toBe("cached");
    expect(s.codePanelModelSlug).toBe("qwen3-coder-30b");
  });

  test("missing cached demo shows placeholder in that viewport; other side still renders", async () => {
    stubs.missingModel = "qwen3-coder-30b";
    await mount();
    await settleExecutor();
    expect(screen.getByText(/No cached result for qwen3-coder-30b/i)).toBeTruthy();
    const meshes = screen.getAllByTestId("voxel-instanced-mesh");
    expect(meshes).toHaveLength(1);
  });

  test("Back to editor button sets the store view back to editor", async () => {
    const { store } = await mount();
    act(() => {
      store.getState().setView("compare");
    });
    fireEvent.click(screen.getByRole("button", { name: /back to editor/i }));
    expect(store.getState().view).toBe("editor");
  });

  test("clicking Compare models in the top strip navigates to CompareView", async () => {
    vi.resetModules();
    const react = await import("../store/react");
    react.__resetStoreForTesting();
    const { App } = await import("./App");
    render(<App />);
    const store = react.getStore();
    await store.getState().awaitInit();

    fireEvent.click(screen.getByRole("button", { name: /compare models/i }));

    expect(store.getState().view).toBe("compare");
    await settleExecutor();
    const meshes = screen.getAllByTestId("voxel-instanced-mesh");
    expect(meshes).toHaveLength(2);
  });

  test("navigating away from compare does not clear chat messages or lastGoodGrid", async () => {
    const { store } = await mount();
    // seed some messages that should survive navigation
    act(() => {
      store.setState({
        messages: [
          {
            id: "seed",
            role: "assistant",
            text: "",
            label: "Cached example",
            source: "cached",
            modelSlug: "claude-sonnet-4-6",
            script: "//",
          },
        ],
      });
    });
    const gridBefore = store.getState().lastGoodGrid;
    act(() => {
      store.getState().setView("compare");
    });
    fireEvent.click(screen.getByRole("button", { name: /back to editor/i }));
    const s = store.getState();
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].id).toBe("seed");
    expect(s.lastGoodGrid).toBe(gridBefore);
  });
});
