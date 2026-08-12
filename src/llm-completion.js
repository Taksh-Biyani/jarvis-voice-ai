/**
 * Shared OpenAI-compatible chat-completion loop: cycles through a provider's
 * modelQueue on failure (rate limit, outage, empty response) until one
 * succeeds or the queue is exhausted. Used by both OpenRouterClient and
 * GroqClient, which only differ in baseUrl/headers/modelQueue/logPrefix.
 */
export async function fetchChatCompletion({ baseUrl, headers, modelQueue, messages, onLog = () => {}, logPrefix, temperature = 0.7, maxTokens = 350 }) {
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
          max_tokens: maxTokens
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
        onLog({ type: 'SUCCESS', message: `[${logPrefix}] Response from ${model}` });
        return data.choices[0].message.content.trim();
      }

      lastError = new Error("Empty completion returned.");
    } catch (e) {
      lastError = e;
      onLog({ type: 'WARNING', message: `[${logPrefix}] Network error on ${model}: ${e.message}` });
    }
  }

  throw lastError || new Error(`All ${logPrefix} models exhausted.`);
}
