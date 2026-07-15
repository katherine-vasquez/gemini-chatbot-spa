import { describe, it, expect } from "vitest";
import { MODEL_FALLBACK_LIST, isRateLimitError, isTransientError } from "../src/models.js";

describe("Model fallback list", () => {
  it("has at least 2 models so it can fall back", () => {
    expect(MODEL_FALLBACK_LIST.length).toBeGreaterThanOrEqual(2);
  });

  it("has no duplicate models", () => {
    const unique = new Set(MODEL_FALLBACK_LIST);
    expect(unique.size).toBe(MODEL_FALLBACK_LIST.length);
  });
});

describe("isRateLimitError", () => {
  it("detects a 429 error as a rate limit", () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });

  it("does not flag other errors as a rate limit", () => {
    expect(isRateLimitError({ status: 500 })).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

describe("isTransientError", () => {
  it("treats 429, 503, and 404 as errors worth retrying with another model", () => {
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    // 404 covers a model name that's been deprecated/retired — trying the
    // next model in the list is the right move, not a dead end.
    expect(isTransientError({ status: 404 })).toBe(true);
  });

  it("does not treat other errors as transient (not worth switching models)", () => {
    expect(isTransientError({ status: 400 })).toBe(false);
    expect(isTransientError({ status: 401 })).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});
