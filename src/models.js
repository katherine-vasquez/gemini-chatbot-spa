// List of Gemini models to try, in order of preference. gemini-2.5-flash
// is tried first because it has no internal "thinking" step that eats
// into the output token budget.
// gemini-3.5-flash is kept as an extra fallback: it's newer, but being a
// "reasoning" model it needs a higher maxOutputTokens so it doesn't cut
// its response off halfway through.
export const MODEL_FALLBACK_LIST = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
];

// Determines whether a Gemini API error corresponds to a rate limit being
// exceeded (429 - "Too Many Requests" / quota exhausted).
export function isRateLimitError(error) {
  return error?.status === 429;
}

// Determines whether it's worth trying the NEXT model in the list.
// - 429: the current model ran out of quota (per-minute or per-day limit).
// - 503: Google's service is temporarily overloaded.
// Both are problems with that specific model/service, not with the message
// or the API key, so it makes sense to retry with another model. Other
// errors (400, 401, etc.) will fail the same way regardless of the model,
// so there's no point trying further.
export function isTransientError(error) {
  return error?.status === 429 || error?.status === 503;
}
