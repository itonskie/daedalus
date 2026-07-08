import { useEffect, useMemo, useState } from "react";
import { ViewportCanvas } from "../renderer";
import { SandboxExecutor } from "../sandbox";
import { type GridReadback, createGrid } from "../voxel";

const TRACER_SCRIPT = 'sphere(32, 24, 32, 8, "red")';

const EMPTY_GRID: GridReadback = createGrid().readback();

export function App() {
  const executor = useMemo(() => new SandboxExecutor(), []);
  const [grid, setGrid] = useState<GridReadback>(EMPTY_GRID);

  useEffect(() => {
    let cancelled = false;
    executor.execute(TRACER_SCRIPT).then((result) => {
      if (cancelled) return;
      if (result.ok) setGrid(result.grid);
    });
    return () => {
      cancelled = true;
    };
  }, [executor]);

  return <ViewportCanvas grid={grid} />;
}
