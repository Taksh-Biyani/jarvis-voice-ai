/**
 * JARVIS Cross-Platform Game Launcher Orchestrator
 * Bare "launch <game>" entry point: tries Steam, then Xbox, then Epic
 * Games, launching from whichever service has it first. If all three fast
 * fuzzy-matches miss, makes one combined LLM call across the union of every
 * library before giving up — see
 * docs/superpowers/specs/2026-08-12-voice-command-mishearing-recovery-design.md.
 * Falls through to SteamHarness.launchGame()'s own existing Steam-Store-search
 * fallback if nothing matches anywhere — see
 * docs/superpowers/specs/2026-08-12-cross-platform-game-launcher-design.md.
 */
import { resolveWithLlmFallback } from './llm-entity-resolver.js';

export class GameLauncherOrchestrator {
  constructor(options = {}) {
    this.steamHarness = options.steamHarness;
    this.xboxHarness = options.xboxHarness;
    this.epicGamesHarness = options.epicGamesHarness;
    this.xboxLibrary = options.xboxLibrary;
    this.epicGamesLibrary = options.epicGamesLibrary;
    this.resolveEntity = options.resolveEntity;
    this.onLog = options.onLog || (() => {});
  }

  async launchGame(gameQuery, alternatives = []) {
    const steamMatch = await this.steamHarness.resolveGame(gameQuery);
    if (steamMatch) {
      return this.steamHarness.launchGame(gameQuery);
    }

    const xboxGames = await this.xboxLibrary.fetchLibrary();
    if (xboxGames.length && this.xboxLibrary.findGame(gameQuery)) {
      return this.xboxHarness.launchGame(gameQuery);
    }

    const epicGames = await this.epicGamesLibrary.fetchLibrary();
    if (epicGames.length && this.epicGamesLibrary.findGame(gameQuery)) {
      return this.epicGamesHarness.launchGame(gameQuery);
    }

    // All three fast matches missed — one combined LLM call across the union
    // of every library, tagged by platform so we know who to dispatch to.
    // steamHarness.resolveGame() above already fetched steamLibrary if it's
    // configured, so this reads the already-warm in-memory array — no extra fetch.
    const steamGames = this.steamHarness.steamLibrary?.library || [];
    const combined = [
      ...steamGames.map(g => ({ name: g.name, platform: 'steam' })),
      ...xboxGames.map(g => ({ name: g.name, platform: 'xbox' })),
      ...epicGames.map(g => ({ name: g.name, platform: 'epic' }))
    ];
    const llmMatch = await resolveWithLlmFallback({
      query: gameQuery,
      alternatives,
      candidates: combined,
      kind: 'game to launch (any platform)',
      resolveEntity: this.resolveEntity,
      onLog: this.onLog
    });
    if (llmMatch) {
      this.onLog({ type: 'SUCCESS', message: `[GAME LAUNCHER] LLM resolved "${gameQuery}" -> "${llmMatch.name}" on ${llmMatch.platform}.` });
      const harness = { steam: this.steamHarness, xbox: this.xboxHarness, epic: this.epicGamesHarness }[llmMatch.platform];
      return harness.launchGame(llmMatch.name);
    }

    this.onLog({ type: 'HARNESS', message: `[GAME LAUNCHER] "${gameQuery}" not found on Steam, Xbox, or Epic. Falling back to Steam Store search.` });
    return this.steamHarness.launchGame(gameQuery);
  }
}
