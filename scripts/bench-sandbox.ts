import { Script, createContext } from "node:vm";
import type { ExecuteResult, Executor } from "../src/sandbox";
import { mapThrownToError, timeoutError } from "../src/sandbox/errors";
import { createGrid } from "../src/voxel";

const DEFAULT_TIMEOUT_MS = 3000;

export interface BenchSandboxOptions {
  timeoutMs?: number;
}

export class BenchSandboxExecutor implements Executor {
  private readonly timeoutMs: number;

  constructor(options: BenchSandboxOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async execute(scriptString: string): Promise<ExecuteResult> {
    const grid = createGrid();
    const startedAt = performance.now();

    let compiled: Script;
    try {
      compiled = new Script(scriptString);
    } catch (thrown) {
      return {
        ok: false,
        error: mapThrownToError(thrown),
        durationMs: performance.now() - startedAt,
      };
    }

    const context = createContext({
      place: grid.place,
      box: grid.box,
      sphere: grid.sphere,
      line: grid.line,
      Math,
      Number,
      String,
      Array,
      Object,
    });

    try {
      compiled.runInContext(context, { timeout: this.timeoutMs });
    } catch (thrown) {
      if (isTimeoutError(thrown)) {
        return {
          ok: false,
          error: timeoutError(this.timeoutMs),
          durationMs: performance.now() - startedAt,
        };
      }
      return {
        ok: false,
        error: mapThrownToError(thrown),
        durationMs: performance.now() - startedAt,
      };
    }

    return {
      ok: true,
      grid: grid.readback(),
      durationMs: performance.now() - startedAt,
    };
  }
}

function isTimeoutError(thrown: unknown): boolean {
  return thrown instanceof Error && /Script execution timed out/i.test(thrown.message);
}
