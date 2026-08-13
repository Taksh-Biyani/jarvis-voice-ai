/**
 * Some reasoning models (e.g. Groq's qwen/qwen3.6-27b) prefix responses with
 * a <think>...</think> chain-of-thought block before the real answer.
 * Strips it so callers only ever see the final answer, never raw reasoning.
 * If the block never closes (the model ran out of tokens mid-thought, so
 * there's no real answer at all), returns '' — callers treat that the same
 * as an empty completion and fall through to the next model.
 */
function stripThinkTags(content) {
  const withoutClosedBlocks = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // A <think> left over after removing closed pairs means it never closed
  // (ran out of tokens mid-thought) — nothing after it is a real answer.
  if (/<think>/i.test(withoutClosedBlocks)) return '';
  return withoutClosedBlocks.trim();
}

/**
 * Shared OpenAI-compatible chat-completion loop: cycles through a provider's
 * modelQueue on failure (rate limit, outage, empty response) until one
 * succeeds or the queue is exhausted. Used by both OpenRouterClient and
 * GroqClient, which only differ in baseUrl/headers/modelQueue/logPrefix.
 */
export async function fetchChatCompletion({ baseUrl, headers, modelQueue, messages, onLog = () => {}, logPrefix, temperature = 0.7, maxTokens = 350, extraBody = {} }) {
  let lastError = null;
  for (const model of modelQueue) {
    try {
      onLog({ type: 'HARNESS', message: `[${logPrefix}] Trying model: ${model}` });

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...extraBody
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        onLog({ type: 'WARNING', message: `[${logPrefix}] ${model} failed: ${errMsg}. Trying next model...` });
        lastError = new Error(errMsg);
        continue;
      }

      if (data.choices?.[0]?.message?.content) {
        const cleaned = stripThinkTags(data.choices[0].message.content);
        if (cleaned) {
          onLog({ type: 'SUCCESS', message: `[${logPrefix}] Response from ${model}` });
          return cleaned;
        }
        onLog({ type: 'WARNING', message: `[${logPrefix}] ${model} returned only reasoning, no final answer. Trying next model...` });
        lastError = new Error("Response contained no usable content after stripping reasoning.");
        continue;
      }

      lastError = new Error("Empty completion returned.");
    } catch (e) {
      lastError = e;
      onLog({ type: 'WARNING', message: `[${logPrefix}] Network error on ${model}: ${e.message}` });
    }
  }

  throw lastError || new Error(`All ${logPrefix} models exhausted.`);
}
