import type { GridReadback } from "../voxel";
import { type ExecuteError, mapThrownToError, timeoutError } from "./errors";
import { InProcessWorker } from "./in-process-worker";
import { readbackFromCells } from "./run-script";
import type { SandboxWorkerLike } from "./types";

export type { ExecuteError } from "./errors";

export type ExecuteResult =
  | { ok: true; grid: GridReadback; durationMs: number }
  | { ok: false; error: ExecuteError; durationMs: number };

export interface Executor {
  execute(scriptString: string): Promise<ExecuteResult>;
}

export interface SandboxExecutorOptions {
  workerFactory?: () => SandboxWorkerLike;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 3000;

export class SandboxExecutor implements Executor {
  private readonly options: SandboxExecutorOptions;
  private cachedFactory: (() => SandboxWorkerLike) | null = null;

  constructor(options: SandboxExecutorOptions = {}) {
    this.options = options;
  }

  async execute(scriptString: string): Promise<ExecuteResult> {
    const factory = await this.resolveFactory();
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const worker = factory();
    const startedAt = performance.now();

    return new Promise<ExecuteResult>((resolve) => {
      let settled = false;

      const finish = (result: ExecuteResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        worker.onmessage = null;
        worker.onerror = null;
        try {
          worker.terminate();
        } catch {}
        resolve(result);
      };

      const timeoutHandle = setTimeout(() => {
        finish({
          ok: false,
          error: timeoutError(timeoutMs),
          durationMs: performance.now() - startedAt,
        });
      }, timeoutMs);

      worker.onmessage = (event: MessageEvent) => {
        const response = event.data;
        if (response?.ok) {
          finish({
            ok: true,
            grid: readbackFromCells(response.cells),
            durationMs: response.durationMs,
          });
        } else {
          finish({
            ok: false,
            error: response?.error ?? {
              kind: "runtime",
              message: "Worker returned malformed response",
              errorType: "Error",
            },
            durationMs: response?.durationMs ?? performance.now() - startedAt,
          });
        }
      };

      worker.onerror = (event: unknown) => {
        finish({
          ok: false,
          error: mapThrownToError(event),
          durationMs: performance.now() - startedAt,
        });
      };

      try {
        worker.postMessage({ script: scriptString });
      } catch (thrown) {
        finish({
          ok: false,
          error: mapThrownToError(thrown),
          durationMs: performance.now() - startedAt,
        });
      }
    });
  }

  private async resolveFactory(): Promise<() => SandboxWorkerLike> {
    if (this.options.workerFactory) return this.options.workerFactory;
    if (this.cachedFactory) return this.cachedFactory;
    if (typeof Worker === "undefined") {
      this.cachedFactory = () => new InProcessWorker();
      return this.cachedFactory;
    }
    const mod = await import("./browser-worker");
    this.cachedFactory = () => mod.createBrowserWorker();
    return this.cachedFactory;
  }
}
