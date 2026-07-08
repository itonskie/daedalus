import { useMemo } from "react";
import { ViewportCanvas } from "../renderer";
import { useStore } from "../store/react";
import { type GridReadback, createGrid } from "../voxel";

const EMPTY_GRID: GridReadback = createGrid().readback();

export function Viewport() {
  const grid = useStore((s) => s.lastGoodGrid);
  const currentPrompt = useStore((s) => s.currentPrompt);
  const currentScript = useStore((s) => s.currentScript);
  const currentSource = useStore((s) => s.currentSource);
  const currentModelSlug = useStore((s) => s.currentModelSlug);
  const isGenerating = useStore((s) => s.isGenerating);
  const openCodePanel = useStore((s) => s.openCodePanel);

  const resolvedGrid = useMemo(() => grid ?? EMPTY_GRID, [grid]);

  const canViewCode = !!currentScript && !!currentSource && !!currentModelSlug;

  return (
    <section className="viewport-region">
      <ViewportCanvas grid={resolvedGrid} />
      {isGenerating ? (
        <p className="viewport-region__generating" aria-live="polite">
          <span className="spinner-dot" aria-hidden="true" />
          Generating…
        </p>
      ) : null}
      {currentPrompt ? (
        <p className="viewport-region__caption" aria-live="polite">
          {currentPrompt}
        </p>
      ) : null}
      {canViewCode ? (
        <button
          type="button"
          className="viewport-region__view-code"
          onClick={(e) => {
            e.stopPropagation();
            if (currentScript && currentSource && currentModelSlug) {
              openCodePanel(currentSource, currentScript, currentModelSlug);
            }
          }}
        >
          View code
        </button>
      ) : null}
    </section>
  );
}
