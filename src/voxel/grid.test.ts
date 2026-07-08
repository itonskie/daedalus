import { describe, expect, test } from "vitest";
import { createGrid } from "./grid";
import { PALETTE, paletteIndexOf } from "./palette";

const GRID_SIZE = 64;
const cellIndex = (x: number, y: number, z: number) =>
  x + y * GRID_SIZE + z * GRID_SIZE * GRID_SIZE;

describe("createGrid", () => {
  test("readback returns a 262,144-length Uint8Array", () => {
    const g = createGrid();
    const r = g.readback();
    expect(r.size).toBe(64);
    expect(r.cells).toBeInstanceOf(Uint8Array);
    expect(r.cells.length).toBe(262144);
  });

  test("readback returns the stable palette", () => {
    const g = createGrid();
    const r = g.readback();
    expect(r.palette).toBe(PALETTE);
    expect(r.palette.length).toBe(16);
  });

  test("a new grid is empty", () => {
    const g = createGrid();
    const r = g.readback();
    for (let i = 0; i < r.cells.length; i++) {
      if (r.cells[i] !== 0) throw new Error(`cell ${i} not empty`);
    }
    expect(true).toBe(true);
  });

  test("two grids are independent (no state leak)", () => {
    const a = createGrid();
    const b = createGrid();
    a.place(0, 0, 0, "red");
    expect(b.readback().cells[0]).toBe(0);
  });
});

describe("place", () => {
  test("writes to the expected cell with palette index + 1", () => {
    const g = createGrid();
    g.place(0, 0, 0, "red");
    expect(g.readback().cells[0]).toBe(paletteIndexOf("red") + 1);
  });

  test("writes to a mid-grid cell at the correct index", () => {
    const g = createGrid();
    g.place(5, 6, 7, "green");
    expect(g.readback().cells[cellIndex(5, 6, 7)]).toBe(paletteIndexOf("green") + 1);
  });

  test("overwrites an existing cell", () => {
    const g = createGrid();
    g.place(1, 1, 1, "red");
    g.place(1, 1, 1, "blue");
    expect(g.readback().cells[cellIndex(1, 1, 1)]).toBe(paletteIndexOf("blue") + 1);
  });

  test("out-of-bounds is a silent no-op", () => {
    const g = createGrid();
    expect(() => g.place(-1, 0, 0, "red")).not.toThrow();
    expect(() => g.place(64, 0, 0, "red")).not.toThrow();
    expect(() => g.place(0, -1, 0, "red")).not.toThrow();
    expect(() => g.place(0, 64, 0, "red")).not.toThrow();
    expect(() => g.place(0, 0, -1, "red")).not.toThrow();
    expect(() => g.place(0, 0, 64, "red")).not.toThrow();
    for (const c of g.readback().cells) if (c !== 0) throw new Error("wrote to grid");
    expect(true).toBe(true);
  });

  test("coerces numeric args via Math.floor", () => {
    const g = createGrid();
    g.place(1.9, 2.9, 3.9, "red");
    expect(g.readback().cells[cellIndex(1, 2, 3)]).toBe(paletteIndexOf("red") + 1);
  });

  test("unknown color throws with the exact taxonomy message", () => {
    const g = createGrid();
    expect(() => g.place(0, 0, 0, "chartreuse")).toThrow("Unknown color: chartreuse");
  });
});

describe("box", () => {
  test("fills the volume [x, x+w) × [y, y+h) × [z, z+d)", () => {
    const g = createGrid();
    g.box(2, 3, 4, 2, 2, 2, "red");
    const cells = g.readback().cells;
    for (let z = 4; z < 6; z++)
      for (let y = 3; y < 5; y++)
        for (let x = 2; x < 4; x++) {
          expect(cells[cellIndex(x, y, z)]).toBe(paletteIndexOf("red") + 1);
        }
    let filled = 0;
    for (const c of cells) if (c !== 0) filled++;
    expect(filled).toBe(8);
  });

  test("clips at grid bounds without throwing", () => {
    const g = createGrid();
    expect(() => g.box(-2, -2, -2, 4, 4, 4, "red")).not.toThrow();
    const cells = g.readback().cells;
    let filled = 0;
    for (const c of cells) if (c !== 0) filled++;
    expect(filled).toBe(2 * 2 * 2);
    expect(cells[cellIndex(0, 0, 0)]).toBe(paletteIndexOf("red") + 1);
    expect(cells[cellIndex(1, 1, 1)]).toBe(paletteIndexOf("red") + 1);
  });

  test("zero or negative size is silent no-op", () => {
    const g = createGrid();
    g.box(0, 0, 0, 0, 5, 5, "red");
    g.box(0, 0, 0, 5, 0, 5, "red");
    g.box(0, 0, 0, 5, 5, 0, "red");
    g.box(0, 0, 0, -1, 5, 5, "red");
    for (const c of g.readback().cells) if (c !== 0) throw new Error("wrote");
    expect(true).toBe(true);
  });

  test("unknown color throws", () => {
    const g = createGrid();
    expect(() => g.box(0, 0, 0, 1, 1, 1, "chartreuse")).toThrow("Unknown color: chartreuse");
  });
});

describe("sphere", () => {
  test("fills 7 cells at radius 1 (center + 6 face neighbors)", () => {
    const g = createGrid();
    g.sphere(32, 32, 32, 1, "red");
    const cells = g.readback().cells;
    let filled = 0;
    for (const c of cells) if (c !== 0) filled++;
    expect(filled).toBe(7);
    expect(cells[cellIndex(32, 32, 32)]).toBe(paletteIndexOf("red") + 1);
    expect(cells[cellIndex(31, 32, 32)]).toBe(paletteIndexOf("red") + 1);
    expect(cells[cellIndex(33, 32, 32)]).toBe(paletteIndexOf("red") + 1);
  });

  test("fills 33 cells at radius 2", () => {
    const g = createGrid();
    g.sphere(32, 32, 32, 2, "red");
    let filled = 0;
    for (const c of g.readback().cells) if (c !== 0) filled++;
    expect(filled).toBe(33);
  });

  test("radius <= 0 is silent no-op", () => {
    const g = createGrid();
    g.sphere(32, 32, 32, 0, "red");
    g.sphere(32, 32, 32, -3, "red");
    for (const c of g.readback().cells) if (c !== 0) throw new Error("wrote");
    expect(true).toBe(true);
  });

  test("clips at grid bounds without throwing", () => {
    const g = createGrid();
    expect(() => g.sphere(0, 0, 0, 3, "red")).not.toThrow();
    expect(g.readback().cells[cellIndex(0, 0, 0)]).toBe(paletteIndexOf("red") + 1);
  });

  test("unknown color throws", () => {
    const g = createGrid();
    expect(() => g.sphere(32, 32, 32, 4, "chartreuse")).toThrow("Unknown color: chartreuse");
  });
});

describe("line", () => {
  test("axis-aligned line traces every cell inclusive of endpoints", () => {
    const g = createGrid();
    g.line(0, 0, 0, 5, 0, 0, "red");
    const cells = g.readback().cells;
    for (let x = 0; x <= 5; x++) {
      expect(cells[cellIndex(x, 0, 0)]).toBe(paletteIndexOf("red") + 1);
    }
    let filled = 0;
    for (const c of cells) if (c !== 0) filled++;
    expect(filled).toBe(6);
  });

  test("2D diagonal traces the diagonal cells", () => {
    const g = createGrid();
    g.line(0, 0, 0, 3, 3, 0, "red");
    const cells = g.readback().cells;
    for (let i = 0; i <= 3; i++) {
      expect(cells[cellIndex(i, i, 0)]).toBe(paletteIndexOf("red") + 1);
    }
    let filled = 0;
    for (const c of cells) if (c !== 0) filled++;
    expect(filled).toBe(4);
  });

  test("3D diagonal traces the diagonal cells", () => {
    const g = createGrid();
    g.line(0, 0, 0, 2, 2, 2, "red");
    const cells = g.readback().cells;
    expect(cells[cellIndex(0, 0, 0)]).toBe(paletteIndexOf("red") + 1);
    expect(cells[cellIndex(1, 1, 1)]).toBe(paletteIndexOf("red") + 1);
    expect(cells[cellIndex(2, 2, 2)]).toBe(paletteIndexOf("red") + 1);
    let filled = 0;
    for (const c of cells) if (c !== 0) filled++;
    expect(filled).toBe(3);
  });

  test("clips out-of-bounds steps without throwing", () => {
    const g = createGrid();
    expect(() => g.line(-5, 0, 0, 5, 0, 0, "red")).not.toThrow();
    const cells = g.readback().cells;
    for (let x = 0; x <= 5; x++) {
      expect(cells[cellIndex(x, 0, 0)]).toBe(paletteIndexOf("red") + 1);
    }
  });

  test("unknown color throws", () => {
    const g = createGrid();
    expect(() => g.line(0, 0, 0, 1, 1, 1, "chartreuse")).toThrow("Unknown color: chartreuse");
  });
});

describe("palette", () => {
  test("all 16 canonical names resolve", () => {
    const names = [
      "white",
      "black",
      "red",
      "orange",
      "yellow",
      "green",
      "blue",
      "indigo",
      "purple",
      "pink",
      "brown",
      "stone",
      "wood",
      "grass",
      "water",
      "gold",
    ];
    for (const [i, name] of names.entries()) {
      expect(paletteIndexOf(name)).toBe(i);
    }
  });

  test("hex values match api-contracts", () => {
    expect(PALETTE[2]).toEqual({ name: "red", hex: "#EF4444" });
    expect(PALETTE[7]).toEqual({ name: "indigo", hex: "#5E6AD2" });
    expect(PALETTE[15]).toEqual({ name: "gold", hex: "#D4AF37" });
  });

  test("unknown color throws the exact taxonomy message", () => {
    expect(() => paletteIndexOf("chartreuse")).toThrow("Unknown color: chartreuse");
  });
});
