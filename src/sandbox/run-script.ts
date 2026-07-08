import { type GridReadback, createGrid } from "../voxel";
import { type ExecuteError, mapThrownToError } from "./errors";

export type RunResult = { ok: true; cells: Uint8Array } | { ok: false; error: ExecuteError };

const SANDBOX_PARAM_NAMES = [
  "place",
  "box",
  "sphere",
  "line",
  "Math",
  "Number",
  "String",
  "Array",
  "Object",
  "fetch",
  "document",
  "window",
  "console",
  "postMessage",
  "onmessage",
  "XMLHttpRequest",
  "WebSocket",
  "self",
  "globalThis",
];

type CompiledScript = (...args: unknown[]) => void;

export function runScript(scriptString: string): RunResult {
  const grid = createGrid();
  let compiled: CompiledScript;
  try {
    compiled = new Function(...SANDBOX_PARAM_NAMES, scriptString) as CompiledScript;
  } catch (thrown) {
    return { ok: false, error: mapThrownToError(thrown) };
  }
  try {
    compiled(
      grid.place.bind(grid),
      grid.box.bind(grid),
      grid.sphere.bind(grid),
      grid.line.bind(grid),
      Math,
      Number,
      String,
      Array,
      Object,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  } catch (thrown) {
    return { ok: false, error: mapThrownToError(thrown) };
  }
  return { ok: true, cells: grid.readback().cells };
}

export function readbackFromCells(cells: Uint8Array): GridReadback {
  const { palette } = createGrid().readback();
  return { size: 64, cells, palette };
}
