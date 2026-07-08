import { useEffect, useRef, useState } from "react";
import { MANIFEST, getCachedScript } from "../demos";
import { ViewportCanvas } from "../renderer";
import { SandboxExecutor } from "../sandbox";
import { useStore } from "../store/react";
import type { CameraState, ProviderId } from "../store/types";
import type { GridReadback } from "../voxel";

const MODEL_A = "claude-sonnet-4-6";
const MODEL_B = "qwen3-coder-30b";
const MODEL_A_LABEL = "Claude";
const MODEL_B_LABEL = "Qwen3-Coder";

export function CompareView() {
  const cameraCompare = useStore((s) => s.cameraCompare);
  const setCameraCompare = useStore((s) => s.setCameraCompare);
  const setView = useStore((s) => s.setView);
  const openCodePanel = useStore((s) => s.openCodePanel);

  const [selectedPromptSlug, setSelectedPromptSlug] = useState<string>(MANIFEST.prompts[0].slug);

  const scriptA = getCachedScript(selectedPromptSlug, MODEL_A);
  const scriptB = getCachedScript(selectedPromptSlug, MODEL_B);

  return (
    <div className="compare-view">
      <header className="compare-view__top-strip">
        <button type="button" className="compare-view__back" onClick={() => setView("editor")}>
          ← Back to editor
        </button>
        <h1 className="compare-view__title">Compare Models</h1>
        <span aria-hidden="true" />
      </header>
      <div className="compare-view__prompt-row">
        <label htmlFor="compare-prompt" className="compare-view__prompt-label">
          Prompt
        </label>
        <select
          id="compare-prompt"
          className="mono-select compare-view__prompt-select"
          value={selectedPromptSlug}
          onChange={(e) => setSelectedPromptSlug(e.target.value)}
        >
          {MANIFEST.prompts.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.text}
            </option>
          ))}
        </select>
      </div>
      <div className="compare-view__panes">
        <ComparePane
          side="A"
          modelSlug={MODEL_A}
          modelLabel={MODEL_A_LABEL}
          script={scriptA}
          cameraState={cameraCompare}
          onCameraChange={setCameraCompare}
          openCodePanel={openCodePanel}
        />
        <ComparePane
          side="B"
          modelSlug={MODEL_B}
          modelLabel={MODEL_B_LABEL}
          script={scriptB}
          cameraState={cameraCompare}
          onCameraChange={setCameraCompare}
          openCodePanel={openCodePanel}
        />
      </div>
    </div>
  );
}

interface ComparePaneProps {
  side: "A" | "B";
  modelSlug: string;
  modelLabel: string;
  script: string | null;
  cameraState: CameraState | null;
  onCameraChange: (state: CameraState) => void;
  openCodePanel: (
    source: ProviderId,
    script: string,
    modelSlug: string,
    errorCopy?: string,
  ) => void;
}

function ComparePane({
  side,
  modelSlug,
  modelLabel,
  script,
  cameraState,
  onCameraChange,
  openCodePanel,
}: ComparePaneProps) {
  const grid = useCachedGrid(script);

  return (
    <section className="compare-pane" data-side={side}>
      <div className="compare-pane__viewport">
        {script === null ? (
          <p className="compare-pane__missing">No cached result for {modelSlug}.</p>
        ) : grid ? (
          <div key={script} className="compare-pane__canvas">
            <ViewportCanvas grid={grid} cameraState={cameraState} onCameraChange={onCameraChange} />
          </div>
        ) : null}
      </div>
      <div className="compare-pane__footer">
        <div className="compare-pane__labels">
          <div className="compare-pane__model-label">{modelLabel}</div>
          <div className="compare-pane__model-slug">{modelSlug}</div>
        </div>
        {script ? (
          <button
            type="button"
            className="compare-pane__show-code"
            onClick={() => openCodePanel("cached", script, modelSlug)}
          >
            show code
          </button>
        ) : null}
      </div>
    </section>
  );
}

function useCachedGrid(script: string | null): GridReadback | null {
  const [grid, setGrid] = useState<GridReadback | null>(null);
  const executorRef = useRef<SandboxExecutor | null>(null);

  useEffect(() => {
    if (!executorRef.current) executorRef.current = new SandboxExecutor();
    if (!script) {
      setGrid(null);
      return;
    }
    let cancelled = false;
    executorRef.current.execute(script).then((result) => {
      if (cancelled) return;
      if (result.ok) setGrid(result.grid);
      else setGrid(null);
    });
    return () => {
      cancelled = true;
    };
  }, [script]);

  return grid;
}
