export type ExecuteError =
  | { kind: "syntax"; message: string; line?: number }
  | { kind: "runtime"; message: string; line?: number; errorType: string }
  | { kind: "timeout"; message: string }
  | { kind: "unknown-color"; message: string; colorName: string };

const UNKNOWN_COLOR_PATTERN = /Unknown color: (\S+)/;

export function mapThrownToError(thrown: unknown): ExecuteError {
  if (thrown instanceof SyntaxError) {
    return {
      kind: "syntax",
      message: thrown.message,
      line: extractLine(thrown),
    };
  }
  if (thrown instanceof Error) {
    const match = thrown.message.match(UNKNOWN_COLOR_PATTERN);
    if (match) {
      return {
        kind: "unknown-color",
        message: thrown.message,
        colorName: match[1],
      };
    }
    return {
      kind: "runtime",
      message: thrown.message,
      errorType: thrown.name || "Error",
      line: extractLine(thrown),
    };
  }
  return {
    kind: "runtime",
    message: String(thrown),
    errorType: typeof thrown,
  };
}

export function timeoutError(ms: number): ExecuteError {
  return {
    kind: "timeout",
    message: `Script exceeded ${ms}ms timeout`,
  };
}

function extractLine(err: Error): number | undefined {
  const stack = err.stack ?? "";
  const match = stack.match(/<anonymous>:(\d+):/) ?? stack.match(/eval.*:(\d+):/);
  if (match) {
    const line = Number.parseInt(match[1], 10);
    return Number.isFinite(line) ? line : undefined;
  }
  return undefined;
}
