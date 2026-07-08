import { useEffect, useMemo, useState } from "react";
import { ViewportCanvas } from "../renderer";
import { VIEWPORT_FAILED_HINT } from "../store/error-copy";
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
  const showLastFailedHint = useStore((s) => s.showLastFailedHint);
  const openCodePanel = useStore((s) => s.openCodePanel);
  const cancelGeneration = useStore((s) => s.cancelGeneration);

  const elapsed = useElapsedSeconds(isGenerating);
  const escalation = escalationCopy(elapsed);

  const resolvedGrid = useMemo(() => grid ?? EMPTY_GRID, [grid]);
  const canViewCode = !!currentScript && !!currentSource && !!currentModelSlug;

  return (
    <section className="viewport-region">
      <ViewportCanvas grid={resolvedGrid} />
      {isGenerating ? (
        <p
          className="viewport-region__generating"
          data-testid="viewport-generating"
          aria-live="polite"
        >
          <span className="spinner-dot" aria-hidden="true" />
          <span>Generating…</span>
          <span className="viewport-region__generating-elapsed">{elapsed}s</span>
          <span className="viewport-region__generating-sep" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            className="viewport-region__cancel"
            onClick={() => cancelGeneration()}
          >
            Cancel
          </button>
          {escalation ? (
            <>
              <span className="viewport-region__generating-sep" aria-hidden="true">
                ·
              </span>
              <span className="viewport-region__generating-hint">{escalation}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {!isGenerating && showLastFailedHint ? (
        <p className="viewport-region__failed" aria-live="polite">
          {VIEWPORT_FAILED_HINT}
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

function useElapsedSeconds(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);
  return elapsed;
}

function escalationCopy(elapsed: number): string | null {
  if (elapsed >= 60) return "Taking longer than usual.";
  if (elapsed >= 15) return "First request warms the model.";
  return null;
}
