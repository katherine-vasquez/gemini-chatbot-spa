import { describe, it, expect, beforeEach } from "vitest";
import {
  formatMessage,
  isEmpty,
  resolveRoute,
  parseRetryDelaySeconds,
  saveHistory,
  loadHistory,
  clearHistory,
  hasStoredHistory,
  formatTimestamp,
} from "../public/utils.js";

describe("Chat Utils", () => {
  it("formats messages correctly", () => {
    expect(formatMessage("User", "hello")).toBe("User: hello");
  });

  it("detects empty text", () => {
    expect(isEmpty("")).toBe(true);
    expect(isEmpty("   ")).toBe(true);
  });

  it("detects valid text", () => {
    expect(isEmpty("hello")).toBe(false);
  });
});

describe("SPA Router (resolveRoute)", () => {
  it("resolves '/' and '/home' as home", () => {
    expect(resolveRoute("/")).toBe("home");
    expect(resolveRoute("/home")).toBe("home");
  });

  it("resolves '/chat' correctly", () => {
    expect(resolveRoute("/chat")).toBe("chat");
  });

  it("resolves '/about' correctly", () => {
    expect(resolveRoute("/about")).toBe("about");
  });

  it("returns null for unknown routes (to show the 404 view)", () => {
    expect(resolveRoute("/does-not-exist")).toBe(null);
  });
});

describe("Rate limit handling (parseRetryDelaySeconds)", () => {
  it("extracts the seconds from a string like '8s'", () => {
    expect(parseRetryDelaySeconds("8s")).toBe(8);
  });

  it("defaults to 60s if retryDelay is missing", () => {
    expect(parseRetryDelaySeconds(undefined)).toBe(60);
    expect(parseRetryDelaySeconds(null)).toBe(60);
  });

  it("defaults to 60s if the format can't be parsed", () => {
    expect(parseRetryDelaySeconds("weird-format")).toBe(60);
  });
});

// localStorage doesn't exist in the Node environment where Vitest runs,
// so we create a fake in-memory version, same as we did with fetch.
function createFakeLocalStorage() {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

describe("History persistence (localStorage)", () => {
  beforeEach(() => {
    global.localStorage = createFakeLocalStorage();
  });

  it("has no saved history at the start", () => {
    expect(hasStoredHistory()).toBe(false);
    expect(loadHistory()).toEqual([]);
  });

  it("saves and then loads the same history", () => {
    const history = [{ role: "User", text: "Hello" }];
    saveHistory(history);

    expect(hasStoredHistory()).toBe(true);
    expect(loadHistory()).toEqual(history);
  });

  it("clears the saved history", () => {
    saveHistory([{ role: "User", text: "Hello" }]);
    clearHistory();

    expect(hasStoredHistory()).toBe(false);
    expect(loadHistory()).toEqual([]);
  });
});

describe("formatTimestamp", () => {
  it("returns the time in short format (HH:MM)", () => {
    const result = formatTimestamp(new Date("2026-01-01T15:30:00"));
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("accepts a number (Date.now()) in addition to a Date object", () => {
    const result = formatTimestamp(Date.now());
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});
