/**
 * OpenRouter AI Client for JARVIS
 * Routes conversational requests through OpenRouter's free model pool with
 * automatic failover across verified working free endpoints.
 */

import { fetchChatCompletion } from './llm-completion.js';
import { buildJarvisMessages } from './llm-persona.js';

export class OpenRouterClient {
  constructor(apiKey = '', options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.onLog = options.onLog || (() => {});

    // Ordered list of verified working free models (as of Aug 2026)
    // openrouter/free = OpenRouter's own dynamic free model router (best first-try)
    this.modelQueue = [
      'openrouter/free',
      'nvidia/nemotron-nano-9b-v2:free',
      'nvidia/nemotron-nano-12b-v2-vl:free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3-super-120b-a12b:free'
    ];
  }

  /**
   * Attempts chat completion cycling through the model queue on failure.
   */
  async generateCompletion(messages) {
    if (!this.apiKey) throw new Error("OpenRouter API Key not configured.");

    return fetchChatCompletion({
      baseUrl: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin || 'http://localhost:3000',
        'X-Title': 'JARVIS Voice AI System'
      },
      modelQueue: this.modelQueue,
      messages,
      onLog: this.onLog,
      logPrefix: 'OPENROUTER'
    });
  }

  /**
   * Generates a JARVIS-persona voice response for the given user input.
   */
  async chatWithJarvis(userInput, context = []) {
    try {
      return await this.generateCompletion(buildJarvisMessages(userInput, context));
    } catch (err) {
      this.onLog({ type: 'WARNING', message: `[OPENROUTER FALLBACK] ${err.message}` });
      return null; // null triggers local knowledge base fallback in JarvisCore
    }
  }
}
