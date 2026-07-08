import { useEffect, useRef } from "react";
import type { GridReadback } from "../../voxel";
import { type CameraState, VoxelRenderer } from "../voxel-renderer";

export interface ViewportCanvasProps {
  grid: GridReadback;
  cameraState?: CameraState | null;
  onCameraChange?: (state: CameraState) => void;
}

export function ViewportCanvas({ grid, cameraState, onCameraChange }: ViewportCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<VoxelRenderer | null>(null);
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new VoxelRenderer(containerRef.current);
    rendererRef.current = renderer;
    const unsubscribe = renderer.onCameraChange((state) => {
      onCameraChangeRef.current?.(state);
    });
    return () => {
      unsubscribe();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setGrid(grid);
  }, [grid]);

  useEffect(() => {
    if (cameraState) rendererRef.current?.setCamera(cameraState);
  }, [cameraState]);

  return <div className="viewport" ref={containerRef} />;
}
