// List of Gemini models to try, in order of preference. Google retires
// model versions fairly often (see https://ai.google.dev/gemini-api/docs/deprecations),
// so this list intentionally spans stable and preview tiers as a hedge:
// gemini-3.5-flash (current stable flagship) first, gemini-3.1-flash-lite
// (cheaper/faster stable model) as the first fallback, and gemini-3-flash-preview
// as a last resort if both stable models are ever unavailable.
export const MODEL_FALLBACK_LIST = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
];

// Determines whether a Gemini API error corresponds to a rate limit being
// exceeded (429 - "Too Many Requests" / quota exhausted).
export function isRateLimitError(error) {
  return error?.status === 429;
}

// Determines whether it's worth trying the NEXT model in the list.
// - 429: the current model ran out of quota (per-minute or per-day limit).
// - 503: Google's service is temporarily overloaded.
// - 404: the requested model name isn't available (e.g. Google deprecated
//   or retired it) — trying the next model in the list is exactly the
//   right move here, not a dead end.
// Other errors (400, 401, etc.) will fail the same way regardless of the
// model, so there's no point trying further.
export function isTransientError(error) {
  return error?.status === 429 || error?.status === 503 || error?.status === 404;
}
