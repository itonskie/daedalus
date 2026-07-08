/// <reference lib="webworker" />
import { runScript } from "./run-script";

declare const self: DedicatedWorkerGlobalScope;

const HAZARDOUS_GLOBALS = ["fetch", "XMLHttpRequest", "WebSocket"] as const;

for (const key of HAZARDOUS_GLOBALS) {
  try {
    delete (self as unknown as Record<string, unknown>)[key];
  } catch {}
}

const originalPostMessage = self.postMessage.bind(self);

self.onmessage = (event: MessageEvent<{ script: string }>) => {
  const { script } = event.data;
  const startedAt = performance.now();
  const result = runScript(script);
  const durationMs = performance.now() - startedAt;

  if (result.ok) {
    originalPostMessage(
      { ok: true, cells: result.cells, durationMs },
      { transfer: [result.cells.buffer] },
    );
  } else {
    originalPostMessage({ ok: false, error: result.error, durationMs });
  }
};
