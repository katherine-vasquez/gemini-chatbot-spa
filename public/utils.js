// Utility functions: data transformation, parsing, and routing.
// Kept pure (no DOM access) so they're easy to test and can be reused
// on both the frontend and the serverless function.

export function formatMessage(role, text) {
  return `${role}: ${text}`;
}

export function isEmpty(text) {
  return !text || text.trim().length === 0;
}

// Decides which view corresponds to a URL. Returns null if the route
// doesn't exist, so the router can show a 404 view.
export function resolveRoute(pathname) {
  if (pathname === "/" || pathname === "/home") return "home";
  if (pathname === "/chat") return "chat";
  if (pathname === "/about") return "about";
  return null;
}

// Converts the message history shown on screen
// (role: "User" | "Solstice") into the format expected by the Gemini API
// (role: "user" | "model").
export function mapHistoryForGemini(messages) {
  return (messages || [])
    .filter((m) => m && (m.role === "User" || m.role === "Solstice") && m.text)
    .map((m) => ({
      role: m.role === "User" ? "user" : "model",
      parts: [{ text: m.text }],
    }));
}

// Parses the JSON response returned by /api/functions, with a fallback
// message if the response is missing the expected field.
export function parseGeminiReply(data) {
  if (!data || typeof data.reply !== "string" || !data.reply.trim()) {
    return "I don't have a reply 😅";
  }
  return data.reply;
}

// Converts the "retryDelay" returned by the Gemini API (e.g. "8s") into a
// number of seconds. If it's missing or unreadable, defaults to a safe 60s.
export function parseRetryDelaySeconds(retryDelay) {
  if (!retryDelay) return 60;
  const match = String(retryDelay).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 60;
}

// Makes the actual call to /api/functions. Exported as its own function
// (instead of inlining it in app.js) so it can be tested with mocked
// fetch without ending up with a "circular test".
export async function sendChatMessage(message, history) {
  const res = await fetch("/api/functions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: mapHistoryForGemini(history) }),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data?.error || `HTTP ${res.status}`);
    error.status = res.status;
    error.retryDelay = data?.retryDelay;
    throw error;
  }

  return parseGeminiReply(data);
}

// -------------------- PERSISTENCE WITH localStorage --------------------
// Fixed key under which the history is stored in the browser.
const HISTORY_STORAGE_KEY = "solstice-chat-history";

// Saves the full history to localStorage (as a JSON string, which is the
// only thing localStorage can store). If localStorage isn't available
// (e.g. restricted incognito mode), fails silently without breaking the
// chat.
export function saveHistory(messages) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error("Could not save history:", error);
  }
}

// Loads the saved history. If there's nothing saved, or something went
// wrong reading it, returns an empty array (as if it were a new session).
export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Could not load history:", error);
    return [];
  }
}

// Completely clears the saved history.
export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error("Could not clear history:", error);
  }
}

// true if there's a history currently saved (used for the "History
// saved" visual indicator).
export function hasStoredHistory() {
  try {
    return localStorage.getItem(HISTORY_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

// -------------------- TIMESTAMPS --------------------
// Formats a date as a short time string (e.g. "3:45 PM"), to show next
// to each chat message.
export function formatTimestamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
