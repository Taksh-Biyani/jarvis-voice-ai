/**
 * JARVIS Epic Games Automation Harness
 * Opens the Epic Games Launcher via its `com.epicgames.launcher://` URI
 * protocol handler. Open-launcher only — no game-specific launch or
 * library lookup (see docs/superpowers/plans/2026-08-12-epic-xbox-connectors.md
 * for why this is intentionally scoped this way).
 */

export class EpicGamesHarness {
  constructor(options = {}) {
    this.onLog = options.onLog || (() => {});
  }

  /**
   * Opens the Epic Games Launcher via its URI protocol handler.
   */
  openApp() {
    this.onLog({
      type: 'HARNESS',
      message: '[EPIC GAMES HARNESS] Initiating Epic Games Launcher launch protocol...'
    });

    window.location.href = 'com.epicgames.launcher://start';

    return {
      success: true,
      message: 'Opening Epic Games Launcher, Sir.'
    };
  }
}
