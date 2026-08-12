/**
 * JARVIS Epic Games Library Integration
 * Reads installed games from Epic Games Launcher's local manifest files
 * (via the Electron main process — see electron/main.cjs's
 * epic:get-installed-games handler), caches them in localStorage, and
 * provides fuzzy name resolution for voice-triggered launches.
 */
import { fuzzyMatchGameName } from './game-name-matcher.js';

export class EpicGamesLibrary {
  constructor(options = {}) {
    this.onLog = options.onLog || (() => {});
    this.library = [];
    this.lastFetched = null;
    this.cacheKey = 'jarvis_epic_library_cache';
    this.cacheMaxAgeMs = 1000 * 60 * 60; // 1 hour
  }

  async fetchLibrary(forceRefresh = false) {
    if (!forceRefresh && this.library.length > 0 && this.lastFetched && (Date.now() - this.lastFetched) < this.cacheMaxAgeMs) {
      return this.library;
    }

    if (!forceRefresh) {
      const cached = this._loadCache();
      if (cached) {
        this.library = cached;
        this.onLog({ type: 'HARNESS', message: `[EPIC LIBRARY] Loaded ${this.library.length} games from cache.` });
        return this.library;
      }
    }

    if (typeof window === 'undefined' || !window.jarvisElectron?.isElectron) {
      return [];
    }

    try {
      const rawGames = await window.jarvisElectron.epicGetInstalledGames();
      this.library = rawGames.map(g => ({
        name: g.displayName,
        nameLower: g.displayName.toLowerCase(),
        appName: g.appName,
        catalogNamespace: g.catalogNamespace,
        catalogItemId: g.catalogItemId
      }));
      this.lastFetched = Date.now();
      this._saveCache(this.library);
      this.onLog({ type: 'SUCCESS', message: `[EPIC LIBRARY] Loaded ${this.library.length} games from your Epic Games library.` });
      return this.library;
    } catch (err) {
      this.onLog({ type: 'WARNING', message: `[EPIC LIBRARY] Failed to read installed games: ${err.message}` });
      return [];
    }
  }

  findGame(query) {
    return fuzzyMatchGameName(query, this.library);
  }

  _loadCache() {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return null;
      const { ts, games } = JSON.parse(raw);
      if ((Date.now() - ts) > this.cacheMaxAgeMs) return null;
      this.lastFetched = ts;
      return games;
    } catch (e) {
      return null;
    }
  }

  _saveCache(library) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify({ ts: Date.now(), games: library }));
    } catch (e) {
      console.warn('Could not save Epic Games library cache:', e);
    }
  }
}
