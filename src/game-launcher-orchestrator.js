/**
 * JARVIS Cross-Platform Game Launcher Orchestrator
 * Bare "launch <game>" entry point: tries Steam, then Xbox, then Epic
 * Games, launching from whichever service has it first. Falls through to
 * SteamHarness.launchGame()'s own existing Steam-Store-search fallback if
 * none match anywhere — see
 * docs/superpowers/specs/2026-08-12-cross-platform-game-launcher-design.md.
 */
export class GameLauncherOrchestrator {
  constructor(options = {}) {
    this.steamHarness = options.steamHarness;
    this.xboxHarness = options.xboxHarness;
    this.epicGamesHarness = options.epicGamesHarness;
    this.xboxLibrary = options.xboxLibrary;
    this.epicGamesLibrary = options.epicGamesLibrary;
    this.onLog = options.onLog || (() => {});
  }

  async launchGame(gameQuery) {
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

    this.onLog({ type: 'HARNESS', message: `[GAME LAUNCHER] "${gameQuery}" not found on Steam, Xbox, or Epic. Falling back to Steam Store search.` });
    return this.steamHarness.launchGame(gameQuery);
  }
}
