import { useMemo } from "react";
import { ViewportCanvas } from "../renderer";
import { createGrid } from "../voxel";

export function App() {
  const grid = useMemo(() => {
    const g = createGrid();
    g.sphere(32, 24, 32, 8, "red");
    return g.readback();
  }, []);
  return <ViewportCanvas grid={grid} />;
}
