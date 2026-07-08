import { PALETTE, type PaletteColor } from "./palette";
import { GRID_SIZE, box, line, place, sphere } from "./primitives";

export interface GridReadback {
  readonly size: 64;
  readonly cells: Uint8Array;
  readonly palette: readonly PaletteColor[];
}

export interface Grid {
  place(x: number, y: number, z: number, color: string): void;
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string): void;
  sphere(cx: number, cy: number, cz: number, r: number, color: string): void;
  line(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: string): void;
  readback(): GridReadback;
}

export function createGrid(): Grid {
  const cells = new Uint8Array(GRID_SIZE * GRID_SIZE * GRID_SIZE);
  return {
    place: (x, y, z, color) => place(cells, x, y, z, color),
    box: (x, y, z, w, h, d, color) => box(cells, x, y, z, w, h, d, color),
    sphere: (cx, cy, cz, r, color) => sphere(cells, cx, cy, cz, r, color),
    line: (x1, y1, z1, x2, y2, z2, color) => line(cells, x1, y1, z1, x2, y2, z2, color),
    readback: () => ({ size: 64, cells, palette: PALETTE }),
  };
}
