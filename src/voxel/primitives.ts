import { paletteIndexOf } from "./palette";

export const GRID_SIZE = 64;

const idx3 = (x: number, y: number, z: number) => x + y * GRID_SIZE + z * GRID_SIZE * GRID_SIZE;

const inBounds = (x: number, y: number, z: number) =>
  x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && z >= 0 && z < GRID_SIZE;

const requireNumber = (n: unknown, name: string): number => {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new TypeError(`Expected finite number for ${name}, got ${typeof n}`);
  }
  return n;
};

export function place(cells: Uint8Array, x: number, y: number, z: number, color: string): void {
  const paletteValue = paletteIndexOf(color) + 1;
  const xi = Math.floor(requireNumber(x, "x"));
  const yi = Math.floor(requireNumber(y, "y"));
  const zi = Math.floor(requireNumber(z, "z"));
  if (!inBounds(xi, yi, zi)) return;
  cells[idx3(xi, yi, zi)] = paletteValue;
}

export function box(
  cells: Uint8Array,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
): void {
  const paletteValue = paletteIndexOf(color) + 1;
  const xi = Math.floor(requireNumber(x, "x"));
  const yi = Math.floor(requireNumber(y, "y"));
  const zi = Math.floor(requireNumber(z, "z"));
  const wi = Math.floor(requireNumber(w, "w"));
  const hi = Math.floor(requireNumber(h, "h"));
  const di = Math.floor(requireNumber(d, "d"));
  if (wi <= 0 || hi <= 0 || di <= 0) return;
  const x0 = Math.max(0, xi);
  const y0 = Math.max(0, yi);
  const z0 = Math.max(0, zi);
  const x1 = Math.min(GRID_SIZE, xi + wi);
  const y1 = Math.min(GRID_SIZE, yi + hi);
  const z1 = Math.min(GRID_SIZE, zi + di);
  for (let zz = z0; zz < z1; zz++) {
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        cells[idx3(xx, yy, zz)] = paletteValue;
      }
    }
  }
}

export function sphere(
  cells: Uint8Array,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  color: string,
): void {
  const paletteValue = paletteIndexOf(color) + 1;
  const cxi = Math.floor(requireNumber(cx, "cx"));
  const cyi = Math.floor(requireNumber(cy, "cy"));
  const czi = Math.floor(requireNumber(cz, "cz"));
  const ri = Math.floor(requireNumber(r, "r"));
  if (ri <= 0) return;
  const r2 = ri * ri;
  const x0 = Math.max(0, cxi - ri);
  const y0 = Math.max(0, cyi - ri);
  const z0 = Math.max(0, czi - ri);
  const x1 = Math.min(GRID_SIZE - 1, cxi + ri);
  const y1 = Math.min(GRID_SIZE - 1, cyi + ri);
  const z1 = Math.min(GRID_SIZE - 1, czi + ri);
  for (let zz = z0; zz <= z1; zz++) {
    const dz = zz - czi;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy - cyi;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cxi;
        if (dx * dx + dy * dy + dz * dz <= r2) {
          cells[idx3(xx, yy, zz)] = paletteValue;
        }
      }
    }
  }
}

export function line(
  cells: Uint8Array,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  color: string,
): void {
  const paletteValue = paletteIndexOf(color) + 1;
  let x = Math.floor(requireNumber(x1, "x1"));
  let y = Math.floor(requireNumber(y1, "y1"));
  let z = Math.floor(requireNumber(z1, "z1"));
  const ex = Math.floor(requireNumber(x2, "x2"));
  const ey = Math.floor(requireNumber(y2, "y2"));
  const ez = Math.floor(requireNumber(z2, "z2"));

  const dx = Math.abs(ex - x);
  const dy = Math.abs(ey - y);
  const dz = Math.abs(ez - z);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  const sz = z < ez ? 1 : -1;

  const write = () => {
    if (inBounds(x, y, z)) cells[idx3(x, y, z)] = paletteValue;
  };

  if (dx >= dy && dx >= dz) {
    let p1 = 2 * dy - dx;
    let p2 = 2 * dz - dx;
    for (let i = 0; i <= dx; i++) {
      write();
      if (p1 >= 0) {
        y += sy;
        p1 -= 2 * dx;
      }
      if (p2 >= 0) {
        z += sz;
        p2 -= 2 * dx;
      }
      p1 += 2 * dy;
      p2 += 2 * dz;
      x += sx;
    }
  } else if (dy >= dx && dy >= dz) {
    let p1 = 2 * dx - dy;
    let p2 = 2 * dz - dy;
    for (let i = 0; i <= dy; i++) {
      write();
      if (p1 >= 0) {
        x += sx;
        p1 -= 2 * dy;
      }
      if (p2 >= 0) {
        z += sz;
        p2 -= 2 * dy;
      }
      p1 += 2 * dx;
      p2 += 2 * dz;
      y += sy;
    }
  } else {
    let p1 = 2 * dy - dz;
    let p2 = 2 * dx - dz;
    for (let i = 0; i <= dz; i++) {
      write();
      if (p1 >= 0) {
        y += sy;
        p1 -= 2 * dz;
      }
      if (p2 >= 0) {
        x += sx;
        p2 -= 2 * dz;
      }
      p1 += 2 * dy;
      p2 += 2 * dx;
      z += sz;
    }
  }
}
