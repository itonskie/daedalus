import type { SandboxWorkerLike, WorkerRequest, WorkerResponse } from "./types";
import SandboxWorkerCtor from "./worker?worker";

export function createBrowserWorker(): SandboxWorkerLike {
  const worker = new SandboxWorkerCtor();
  return {
    get onmessage() {
      return (worker.onmessage as SandboxWorkerLike["onmessage"]) ?? null;
    },
    set onmessage(listener) {
      worker.onmessage = listener as unknown as Worker["onmessage"];
    },
    get onerror() {
      return (worker.onerror as SandboxWorkerLike["onerror"]) ?? null;
    },
    set onerror(listener) {
      worker.onerror = listener as unknown as Worker["onerror"];
    },
    postMessage(msg: WorkerRequest) {
      worker.postMessage(msg);
    },
    terminate() {
      worker.terminate();
    },
  } satisfies SandboxWorkerLike;
}

export type _EnsureWorkerResponseType = WorkerResponse;
