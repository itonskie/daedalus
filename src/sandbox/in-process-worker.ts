import { runScript } from "./run-script";
import type { SandboxWorkerLike, WorkerRequest, WorkerResponse } from "./types";

export class InProcessWorker implements SandboxWorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  private terminated = false;

  postMessage(msg: WorkerRequest): void {
    queueMicrotask(() => {
      if (this.terminated) return;
      const startedAt = performance.now();
      const result = runScript(msg.script);
      const durationMs = performance.now() - startedAt;
      const response: WorkerResponse = result.ok
        ? { ok: true, cells: result.cells, durationMs }
        : { ok: false, error: result.error, durationMs };
      const listener = this.onmessage;
      if (listener) {
        listener({ data: response } as MessageEvent<WorkerResponse>);
      }
    });
  }

  terminate(): void {
    this.terminated = true;
    this.onmessage = null;
    this.onerror = null;
  }
}
