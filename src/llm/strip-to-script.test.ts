import { describe, expect, test } from "vitest";
import { LLMProviderError } from "./errors";
import { stripToScript } from "./strip-to-script";

describe("stripToScript", () => {
  test("extracts contents of a ```javascript fenced block", () => {
    const raw = 'Here is your script:\n```javascript\nsphere(32,24,32,8,"red")\n```';
    expect(stripToScript("anthropic", raw)).toBe('sphere(32,24,32,8,"red")');
  });

  test("extracts contents of a ```js fenced block", () => {
    const raw = '```js\nplace(0,0,0,"green")\n```';
    expect(stripToScript("anthropic", raw)).toBe('place(0,0,0,"green")');
  });

  test("extracts contents of a bare ``` fenced block", () => {
    const raw = '```\nbox(0,0,0,4,4,4,"blue")\n```';
    expect(stripToScript("ollama", raw)).toBe('box(0,0,0,4,4,4,"blue")');
  });

  test("returns first fenced block when multiple are present", () => {
    const raw = "```javascript\nfirst\n```\nand\n```js\nsecond\n```";
    expect(stripToScript("anthropic", raw)).toBe("first");
  });

  test("returns trimmed raw content when no fence is present", () => {
    expect(stripToScript("anthropic", '  sphere(32,24,32,8,"red")  ')).toBe(
      'sphere(32,24,32,8,"red")',
    );
  });

  test("throws LLMProviderError(kind:shape) on empty input", () => {
    expect(() => stripToScript("anthropic", "")).toThrow(LLMProviderError);
    try {
      stripToScript("anthropic", "");
    } catch (e) {
      expect(e).toBeInstanceOf(LLMProviderError);
      expect((e as LLMProviderError).kind).toBe("shape");
      expect((e as LLMProviderError).providerId).toBe("anthropic");
    }
  });

  test("throws LLMProviderError(kind:shape) when fenced block is empty after trim", () => {
    expect(() => stripToScript("ollama", "```javascript\n   \n```")).toThrow(LLMProviderError);
  });

  test("throws LLMProviderError(kind:shape) on whitespace-only input", () => {
    expect(() => stripToScript("anthropic", "   \n\t")).toThrow(LLMProviderError);
  });
});
