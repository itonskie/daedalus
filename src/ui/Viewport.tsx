import { useMemo } from "react";
import { ViewportCanvas } from "../renderer";
import { useStore } from "../store/react";
import { type GridReadback, createGrid } from "../voxel";

const EMPTY_GRID: GridReadback = createGrid().readback();

export function Viewport() {
  const grid = useStore((s) => s.lastGoodGrid);
  const currentPrompt = useStore((s) => s.currentPrompt);
  const isGenerating = useStore((s) => s.isGenerating);

  const resolvedGrid = useMemo(() => grid ?? EMPTY_GRID, [grid]);

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
    </section>
  );
}
