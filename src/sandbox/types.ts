import type { ExecuteError } from "./errors";

export interface WorkerRequest {
  script: string;
}

export type WorkerResponse =
  | { ok: true; cells: Uint8Array; durationMs: number }
  | { ok: false; error: ExecuteError; durationMs: number };

export interface SandboxWorkerLike {
  postMessage(msg: WorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: unknown) => void) | null;
}
