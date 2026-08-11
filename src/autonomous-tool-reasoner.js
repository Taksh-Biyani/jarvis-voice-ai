/**
 * Autonomous Tool Calling & Reasoning Engine for JARVIS
 * Analyzes natural language input contextually and determines when to trigger
 * Google Search, Steam Game Launcher, Web Navigation, or System Utilities autonomously.
 */

import { normalizeTierAlias } from './model-tiers.js';

export class AutonomousToolReasoner {
  constructor(options = {}) {
    this.onLog = options.onLog || (() => {});
  }

  /**
   * Evaluates user input and returns tool calling decisions.
   * Format returned:
   * {
   *    shouldCallTool: true|false,
   *    toolName: 'GOOGLE_SEARCH' | 'STEAM_LAUNCH_GAME' | 'STEAM_OPEN_CLIENT' | 'OPEN_SITE' | 'MATH_QUERY' | 'SET_MODEL_TIER' | 'CONVERSATIONAL',
   *    confidence: 0.0 to 1.0,
   *    params: { ... },
   *    reasoning: "Explanation of autonomous decision"
   * }
   */
  evaluateIntent(input) {
    if (!input || !input.trim()) {
      return { shouldCallTool: false, toolName: 'CONVERSATIONAL', confidence: 1.0 };
    }

    const text = input.trim().toLowerCase();

    // 1. Check for gaming & Steam launch intents (implicit & explicit)
    const gamingKeywords = ['play', 'game', 'gaming', 'steam', 'csgo', 'cs2', 'dota', 'cyberpunk', 'elden ring', 'gta', 'apex', 'tf2', 'helldivers', 'pubg', 'rust', 'baldurs gate'];
    const gamingIntentDetected = gamingKeywords.some(kw => text.includes(kw));

    if (gamingIntentDetected) {
      // "lunch" is a common speech-to-text mishearing of "launch" — treat it as an alias.
      if (text.includes('steam') && (text.includes('open') || text.includes('launch') || text.includes('lunch') || text.includes('start'))) {
        return {
          shouldCallTool: true,
          toolName: 'STEAM_OPEN_CLIENT',
          confidence: 0.95,
          params: {},
          reasoning: "Autonomous reasoner identified intent to launch Steam client application."
        };
      }

      // Detect game titles inside phrase
      const gameMatches = [
        { name: "Counter-Strike 2", keywords: ["counter strike", "csgo", "cs2", "counter-strike"] },
        { name: "Dota 2", keywords: ["dota 2", "dota"] },
        { name: "Cyberpunk 2077", keywords: ["cyberpunk 2077", "cyberpunk"] },
        { name: "Elden Ring", keywords: ["elden ring"] },
        { name: "Grand Theft Auto V", keywords: ["gta v", "gta 5", "gta", "grand theft auto"] },
        { name: "Apex Legends", keywords: ["apex legends", "apex"] },
        { name: "Team Fortress 2", keywords: ["tf2", "team fortress"] },
        { name: "Baldur's Gate 3", keywords: ["baldur's gate", "baldurs gate"] },
        { name: "HELLDIVERS 2", keywords: ["helldivers 2", "helldivers"] },
        { name: "PUBG: BATTLEGROUNDS", keywords: ["pubg"] },
        { name: "Rust", keywords: ["rust"] }
      ];

      for (const game of gameMatches) {
        if (game.keywords.some(kw => text.includes(kw))) {
          return {
            shouldCallTool: true,
            toolName: 'STEAM_LAUNCH_GAME',
            confidence: 0.92,
            params: { gameQuery: game.name },
            reasoning: `Autonomous reasoner detected intent to launch game "${game.name}" via Steam Harness.`
          };
        }
      }

      // Generic play request
      const playMatch = text.match(/(?:play|wanna play|want to play|fire up|load up)\s+([a-z0-9\s]+)/i);
      if (playMatch && playMatch[1]) {
        return {
          shouldCallTool: true,
          toolName: 'STEAM_LAUNCH_GAME',
          confidence: 0.85,
          params: { gameQuery: playMatch[1].trim() },
          reasoning: `Autonomous reasoner inferred game launch request for "${playMatch[1].trim()}".`
        };
      }
    }

    // 1b. Broad launch-verb fallback — covers "launch/start/run/open <any title>"
    // even when the sentence has no recognized gaming keyword (e.g. a game only
    // present in the user's real Steam library, like "launch Cookie Clicker").
    // Delegates the actual name resolution to SteamHarness (library -> dict -> store search).
    // "lunch" is included as an alias since speech-to-text frequently mishears "launch" as "lunch".
    const launchMatch = text.match(/(?:launch|lunch|start|run|open)\s+(?:the\s+game\s+|game\s+)?([a-z0-9][a-z0-9\s':\-]*)/i);
    if (launchMatch && launchMatch[1]) {
      const candidate = launchMatch[1].trim();
      const nonGameTargets = ['steam', 'google', 'youtube', 'browser', 'chrome', 'reddit', 'github', 'twitter', 'wikipedia', 'amazon', 'gmail', 'maps'];
      if (!nonGameTargets.includes(candidate)) {
        return {
          shouldCallTool: true,
          toolName: 'STEAM_LAUNCH_GAME',
          confidence: 0.75,
          params: { gameQuery: candidate },
          reasoning: `Autonomous reasoner inferred a game launch request for "${candidate}"; deferring to Steam Harness library resolution.`
        };
      }
    }

    // 2. Check for a model-tier switch command ("switch mode to high",
    // "set mode to max") — checked early, before search/math, since it's an
    // explicit system command rather than something to look up or compute.
    const tierMatch = text.match(/\b(?:switch|set|change)\s+(?:mode|model|tier)\s+to\s+(\w+)\b/i)
      || text.match(/\bswitch\s+to\s+(\w+)\s+mode\b/i);

    if (tierMatch) {
      const tier = normalizeTierAlias(tierMatch[1]);
      if (tier) {
        return {
          shouldCallTool: true,
          toolName: 'SET_MODEL_TIER',
          confidence: 0.95,
          params: { tier },
          reasoning: `Autonomous reasoner detected a request to switch the active Groq model tier to "${tier}".`
        };
      }
      // Recognized phrasing but an unrecognized tier word (e.g. "switch
      // mode to insane") — fall through rather than guess.
    }

    // 3. Check for math queries (arithmetic through high-level math) —
    // checked before the web-search heuristics below, since e.g. "what is 5
    // plus 3" would otherwise match the "what is" search starter. Scoped
    // deliberately to math phrasing only, not a catch-all for trivia.
    const mathSymbolPattern = /\d\s*[+\-*/^]\s*\d|[√∫]/;
    const mathKeywordPattern = /\b(calculate|solve for|square root of|cube root of|derivative of|integral of|factorial of|log of|logarithm of)\b/;
    const mathPhrasePattern = /\b(plus|minus|times|multiplied by|divided by|to the power of|squared|cubed)\b/;
    const percentPattern = /\d+\s*%\s*of\s*\d+|\d+\s*percent\s*of\s*\d+/;

    const looksLikeMath =
      mathSymbolPattern.test(text) ||
      mathKeywordPattern.test(text) ||
      percentPattern.test(text) ||
      (mathPhrasePattern.test(text) && /\d/.test(text));

    if (looksLikeMath) {
      return {
        shouldCallTool: true,
        toolName: 'MATH_QUERY',
        confidence: 0.9,
        params: { query: input },
        reasoning: "Autonomous reasoner classified query as a math computation, routing to WolframAlpha for a grounded answer."
      };
    }

    // 4. Check for real-time Web Search / Info retrieval intents
    const searchStarters = [
      'what is', 'what are', 'who is', 'who was', 'where is', 'where are',
      'how to', 'how does', 'why is', 'why do', 'tell me about', 'find out',
      'look up', 'search', 'news on', 'weather in', 'latest info', 'score of'
    ];

    const isInformationalQuery = searchStarters.some(starter => text.startsWith(starter) || text.includes(starter));
    const specifiesGoogle = text.includes('google') || text.includes('search');

    if (specifiesGoogle || isInformationalQuery) {
      let query = input;
      // Clean up prefix if needed
      searchStarters.forEach(s => {
        if (query.toLowerCase().startsWith(s)) {
          // Keep intact for full context search
        }
      });

      return {
        shouldCallTool: true,
        toolName: 'GOOGLE_SEARCH',
        confidence: isInformationalQuery ? 0.88 : 0.95,
        params: { query: query },
        reasoning: "Autonomous reasoner classified query as requiring real-time web knowledge lookup via Google Harness."
      };
    }

    // 5. Direct Website Intent
    const siteMap = ['youtube', 'github', 'reddit', 'twitter', 'wikipedia', 'amazon', 'gmail', 'maps'];
    for (const site of siteMap) {
      if (text.includes(site) && (text.includes('open') || text.includes('go to') || text.includes('show'))) {
        return {
          shouldCallTool: true,
          toolName: 'OPEN_SITE',
          confidence: 0.94,
          params: { siteName: site },
          reasoning: `Autonomous reasoner identified direct web navigation intent for site "${site}".`
        };
      }
    }

    // 6. Default Conversational / System query
    return {
      shouldCallTool: false,
      toolName: 'CONVERSATIONAL',
      confidence: 0.90,
      params: { text: input },
      reasoning: "Input processed as internal conversational query."
    };
  }
}
