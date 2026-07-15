import { GoogleGenerativeAI } from "@google/generative-ai";
import { mapHistoryForGemini } from "../public/utils.js";
import { SYSTEM_PROMPT } from "../src/chat.js";
import { MODEL_FALLBACK_LIST, isTransientError } from "../src/models.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured on the server" });
  }

  const { message, history } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError = null;

  // Try the models in MODEL_FALLBACK_LIST in order. If one is rate-limited
  // (429), automatically move to the next one, within the same request —
  // keeps the app responsive even when a specific model runs out of quota.
  for (const modelName of MODEL_FALLBACK_LIST) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.8, // a bit of variety, without losing character consistency
          maxOutputTokens: 1024, // extra headroom for models that "think" before responding
        },
      });

      // Pass Gemini the full previous conversation history, so the
      // character keeps context across messages.
      const chat = model.startChat({
        history: mapHistoryForGemini(history),
      });

      const result = await chat.sendMessage(message);
      const reply = result.response.text() || "Solstice is busy ✨";

      return res.status(200).json({ reply, modelUsed: modelName });
    } catch (error) {
      console.error(`Error with model ${modelName}:`, error.message);
      lastError = error;

      // If the error is NOT transient (429 rate-limited / 503 overloaded),
      // there's no point trying other models: it's a different kind of
      // problem (invalid key, malformed message, etc.) that will fail
      // the same way on any model.
      if (!isTransientError(error)) break;
      // If it IS a 429 or 503, the loop continues and tries the next model.
    }
  }

  // If we got here, no model responded successfully.
  if (isTransientError(lastError)) {
    const retryInfo = lastError.errorDetails?.find((d) =>
      d["@type"]?.includes("RetryInfo")
    );

    return res.status(429).json({
      error: "All available models are currently rate-limited or unavailable",
      retryDelay: retryInfo?.retryDelay || "60s",
    });
  }

  console.error("Error in /api/functions:", lastError);
  return res.status(500).json({
    error: "Error calling Gemini",
    details: lastError?.message,
  });
}
