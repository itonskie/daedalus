import { useEffect, useRef } from "react";
import type { GridReadback } from "../../voxel";
import { VoxelRenderer } from "../voxel-renderer";

export interface ViewportCanvasProps {
  grid: GridReadback;
}

export function ViewportCanvas({ grid }: ViewportCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<VoxelRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new VoxelRenderer(containerRef.current);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setGrid(grid);
  }, [grid]);

  return <div className="viewport" ref={containerRef} />;
}
