/**
 * Groq AI Client for JARVIS
 * Routes conversational requests through Groq's low-latency inference API —
 * much faster than OpenRouter's free pool for basic conversation, at the
 * cost of a smaller/less capable default model.
 */

import { fetchChatCompletion } from './llm-completion.js';
import { buildJarvisMessages } from './llm-persona.js';
import { MODEL_TIERS } from './model-tiers.js';

export class GroqClient {
  constructor(apiKey = '', options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
    this.onLog = options.onLog || (() => {});

    this.currentTier = 'quick';
    this.modelQueue = [MODEL_TIERS.quick.model];

    // Dedicated single-model queue for screen-vision requests — most Groq
    // text models can't accept image content, so vision calls never touch
    // the tier-based modelQueue above. meta-llama/llama-4-scout-17b-16e-instruct
    // was the original pick here but Groq deprecated it 2026-07-17; this is
    // its documented replacement (console.groq.com/docs/deprecations),
    // confirmed vision-capable (up to 5 images) as of 2026-08.  Re-verify
    // against console.groq.com/docs/models if this ever errors again.
    this.visionModelQueue = ['qwen/qwen3.6-27b'];
  }

  /**
   * Switches which Groq model this client calls, via the tier picked from
   * the HUD slider or a "switch mode to X" voice command.
   */
  setTier(tierKey) {
    const tier = MODEL_TIERS[tierKey];
    if (!tier) return;
    this.currentTier = tierKey;
    this.modelQueue = [tier.model];
  }

  /**
   * Attempts chat completion cycling through the model queue on failure.
   */
  async generateCompletion(messages, options = {}) {
    if (!this.apiKey) throw new Error("Groq API Key not configured.");

    return fetchChatCompletion({
      baseUrl: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      modelQueue: this.modelQueue,
      messages,
      onLog: this.onLog,
      logPrefix: 'GROQ',
      temperature: options.temperature,
      maxTokens: options.maxTokens
    });
  }

  /**
   * Vision-capable completion for screen-vision questions — see
   * docs/superpowers/specs/2026-08-12-screen-vision-and-ai-reasoner-design.md.
   */
  async generateVisionCompletion(messages, options = {}) {
    if (!this.apiKey) throw new Error("Groq API Key not configured.");

    return fetchChatCompletion({
      baseUrl: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      modelQueue: this.visionModelQueue,
      messages,
      onLog: this.onLog,
      logPrefix: 'GROQ VISION',
      temperature: options.temperature,
      maxTokens: options.maxTokens
    });
  }

  /**
   * Generates a JARVIS-persona voice response for the given user input.
   */
  async chatWithJarvis(userInput, context = []) {
    try {
      return await this.generateCompletion(buildJarvisMessages(userInput, context));
    } catch (err) {
      this.onLog({ type: 'WARNING', message: `[GROQ FALLBACK] ${err.message}` });
      return null; // null triggers OpenRouter fallback in JarvisCore
    }
  }
}
