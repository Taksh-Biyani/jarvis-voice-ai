/**
 * Groq model tiers JARVIS can switch between via the HUD slider or a voice
 * command ("switch mode to high"). Model IDs verified against
 * console.groq.com/docs/models — update here if Groq deprecates one.
 */

export const MODEL_TIERS = {
  quick: { model: 'llama-3.1-8b-instant', label: 'Quick' },
  medium: { model: 'llama-3.3-70b-versatile', label: 'Medium' },
  high: { model: 'openai/gpt-oss-120b', label: 'High' },
  // Groq's agentic system — can autonomously invoke web search/code
  // execution mid-response. The only option above gpt-oss-120b on Groq's
  // free tier; called through the same chat-completions shape as the rest.
  ultra: { model: 'groq/compound', label: 'Ultra' }
};

export const TIER_ORDER = ['quick', 'medium', 'high', 'ultra'];

const ALIASES = {
  quick: 'quick', low: 'quick', fast: 'quick',
  medium: 'medium', mid: 'medium',
  high: 'high',
  ultra: 'ultra', max: 'ultra', maximum: 'ultra'
};

/**
 * Normalizes a spoken/typed word to a canonical tier key, or null if it
 * isn't a recognized tier — callers should treat null as "not a tier
 * command" rather than guessing.
 */
export function normalizeTierAlias(word) {
  if (!word) return null;
  return ALIASES[word.toLowerCase()] || null;
}
