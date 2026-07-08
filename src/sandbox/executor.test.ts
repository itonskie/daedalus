import { describe, expect, test } from "vitest";
import { paletteIndexOf } from "../voxel";
import { SandboxExecutor } from "./executor";
import type { SandboxWorkerLike } from "./types";

describe("SandboxExecutor", () => {
  test("valid script fills the expected cell", async () => {
    const exec = new SandboxExecutor();
    const r = await exec.execute('place(0,0,0,"red")');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.grid.cells[0]).toBe(paletteIndexOf("red") + 1);
      expect(r.grid.size).toBe(64);
      expect(r.grid.palette.length).toBe(16);
      expect(typeof r.durationMs).toBe("number");
      expect(r.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  test("syntax error resolves — not rejects — with kind:syntax", async () => {
    const exec = new SandboxExecutor();
    const r = await exec.execute("!!!not js");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("syntax");
      if (r.error.kind === "syntax") {
        expect(typeof r.error.message).toBe("string");
        expect(r.error.message.length).toBeGreaterThan(0);
      }
    }
  });

  test("runtime throw resolves with kind:runtime + errorType", async () => {
    const exec = new SandboxExecutor();
    const r = await exec.execute('throw new TypeError("boom")');
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "runtime") {
      expect(r.error.errorType).toBe("TypeError");
      expect(r.error.message).toContain("boom");
    } else {
      throw new Error("expected runtime error");
    }
  });

  test('place(0,0,0,"chartreuse") → kind:unknown-color with colorName', async () => {
    const exec = new SandboxExecutor();
    const r = await exec.execute('place(0,0,0,"chartreuse")');
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "unknown-color") {
      expect(r.error.colorName).toBe("chartreuse");
      expect(r.error.message).toContain("chartreuse");
    } else {
      throw new Error("expected unknown-color error");
    }
  });

  test("timeout resolves as kind:timeout when worker never responds", async () => {
    const exec = new SandboxExecutor({
      workerFactory: () => new NeverRespondingWorker(),
      timeoutMs: 50,
    });
    const started = performance.now();
    const r = await exec.execute("while(true){}");
    const elapsed = performance.now() - started;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("timeout");
    expect(elapsed).toBeLessThan(4000);
  });

  test("terminate() is called on the worker once execution settles", async () => {
    let terminated = false;
    const exec = new SandboxExecutor({
      workerFactory: () => {
        const w = new (class implements SandboxWorkerLike {
          onmessage: SandboxWorkerLike["onmessage"] = null;
          onerror: SandboxWorkerLike["onerror"] = null;
          postMessage(): void {
            queueMicrotask(() => {
              this.onmessage?.({
                data: {
                  ok: true,
                  cells: new Uint8Array(64 * 64 * 64),
                  durationMs: 0,
                },
              } as MessageEvent);
            });
          }
          terminate(): void {
            terminated = true;
          }
        })();
        return w;
      },
    });
    await exec.execute('place(0,0,0,"red")');
    expect(terminated).toBe(true);
  });

  test("API surface regression guard: place/box/sphere/line all present", async () => {
    const exec = new SandboxExecutor();
    const script = `
      if (
        typeof place === "function" &&
        typeof box === "function" &&
        typeof sphere === "function" &&
        typeof line === "function"
      ) {
        place(0, 0, 0, "red");
      }
    `;
    const r = await exec.execute(script);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.grid.cells[0]).toBe(paletteIndexOf("red") + 1);
    }
  });

  test("hazardous globals are undefined inside the sandbox", async () => {
    const exec = new SandboxExecutor();
    const script = `
      if (
        typeof fetch === "undefined" &&
        typeof document === "undefined" &&
        typeof window === "undefined" &&
        typeof console === "undefined" &&
        typeof postMessage === "undefined" &&
        typeof onmessage === "undefined" &&
        typeof XMLHttpRequest === "undefined" &&
        typeof WebSocket === "undefined"
      ) {
        place(0, 0, 0, "green");
      }
    `;
    const r = await exec.execute(script);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.grid.cells[0]).toBe(paletteIndexOf("green") + 1);
    }
  });

  test("safe globals (Math, Number, String, Array, Object) are present", async () => {
    const exec = new SandboxExecutor();
    const script = `
      if (
        typeof Math === "object" &&
        typeof Number === "function" &&
        typeof String === "function" &&
        typeof Array === "function" &&
        typeof Object === "function"
      ) {
        place(Math.floor(0), 0, 0, "blue");
      }
    `;
    const r = await exec.execute(script);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.grid.cells[0]).toBe(paletteIndexOf("blue") + 1);
    }
  });

  test("two concurrent execute calls return independent results", async () => {
    const exec = new SandboxExecutor();
    const [a, b] = await Promise.all([
      exec.execute('place(0,0,0,"red")'),
      exec.execute('place(1,0,0,"green")'),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok) {
      expect(a.grid.cells[0]).toBe(paletteIndexOf("red") + 1);
      expect(a.grid.cells[1]).toBe(0);
    }
    if (b.ok) {
      expect(b.grid.cells[0]).toBe(0);
      expect(b.grid.cells[1]).toBe(paletteIndexOf("green") + 1);
    }
  });

  test("execute never rejects — even when the worker synchronously throws", async () => {
    const exec = new SandboxExecutor({
      workerFactory: () => {
        return new (class implements SandboxWorkerLike {
          onmessage: SandboxWorkerLike["onmessage"] = null;
          onerror: SandboxWorkerLike["onerror"] = null;
          postMessage(): void {
            throw new Error("worker exploded");
          }
          terminate(): void {}
        })();
      },
    });
    const r = await exec.execute('place(0,0,0,"red")');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("worker exploded");
  });

  test("empty script resolves ok with an empty grid", async () => {
    const exec = new SandboxExecutor();
    const r = await exec.execute("");
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (let i = 0; i < r.grid.cells.length; i++) {
        if (r.grid.cells[i] !== 0) throw new Error(`cell ${i} not empty`);
      }
    }
  });
});

class NeverRespondingWorker implements SandboxWorkerLike {
  onmessage: SandboxWorkerLike["onmessage"] = null;
  onerror: SandboxWorkerLike["onerror"] = null;
  postMessage(): void {}
  terminate(): void {}
}
