import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendChatMessage } from "../public/utils.js";

// Global fetch mock (FSM3L8): we test the real function that calls fetch,
// not a "loose" fetch inside the test (that would be a circular test).
describe("sendChatMessage (mocked fetch, no network)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("sends message + history and returns Solstice's reply", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ reply: "Let's shine some light on that! ✨" }),
    });

    const history = [{ role: "User", text: "Hello" }];
    const reply = await sendChatMessage("Who are you?", history);

    expect(fetch).toHaveBeenCalledWith(
      "/api/functions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Who are you?",
          history: [{ role: "user", parts: [{ text: "Hello" }] }],
        }),
      })
    );
    expect(reply).toBe("Let's shine some light on that! ✨");
  });

  it("throws a readable error when the server responds with an error", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "API key not configured" }),
    });

    await expect(sendChatMessage("Hello", [])).rejects.toThrow(
      "API key not configured"
    );
  });

  it("propagates network errors (offline / rejected fetch)", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(sendChatMessage("Hello", [])).rejects.toThrow("Network error");
  });
});
