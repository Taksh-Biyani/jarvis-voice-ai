/**
 * JARVIS Steam Library Integration
 * Fetches the user's full Steam game library via Steam Web API,
 * caches it in localStorage, and provides fuzzy name-to-AppID resolution
 * so any owned game can be launched by voice.
 */

export class SteamLibrary {
  constructor(options = {}) {
    this.onLog = options.onLog || (() => {});

    // Priority: VITE env vars (baked at build) > localStorage (set via UI) > empty
    this.apiKey = options.apiKey
      || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STEAM_API_KEY)
      || localStorage.getItem('jarvis_steam_api_key')
      || '';
    this.steamId = options.steamId
      || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STEAM_ID)
      || localStorage.getItem('jarvis_steam_id')
      || '';

    this.library = [];
    this.lastFetched = null;
    this.cacheKey = 'jarvis_steam_library_cache';
    this.cacheMaxAgeMs = 1000 * 60 * 60; // 1 hour
  }

  /**
   * Configure credentials and persist them
   */
  configure(apiKey, steamId) {
    this.apiKey = apiKey.trim();
    this.steamId = steamId.trim();
    localStorage.setItem('jarvis_steam_api_key', this.apiKey);
    localStorage.setItem('jarvis_steam_id', this.steamId);
    this.onLog({ type: 'SUCCESS', message: '[STEAM LIBRARY] Credentials saved to local storage.' });
  }

  isConfigured() {
    return Boolean(this.apiKey && this.steamId);
  }

  /**
   * Fetch full game library from Steam Web API.
   * Uses a CORS-friendly proxy pattern.
   */
  async fetchLibrary(forceRefresh = false) {
    // Return cached if fresh enough
    if (!forceRefresh && this.library.length > 0 && this.lastFetched && (Date.now() - this.lastFetched) < this.cacheMaxAgeMs) {
      return this.library;
    }

    // Try loading from localStorage cache first
    if (!forceRefresh) {
      const cached = this._loadCache();
      if (cached) {
        this.library = cached;
        this.onLog({ type: 'HARNESS', message: `[STEAM LIBRARY] Loaded ${this.library.length} games from cache.` });
        return this.library;
      }
    }

    if (!this.isConfigured()) {
      this.onLog({ type: 'WARNING', message: '[STEAM LIBRARY] Steam API Key and Steam ID not configured. Cannot fetch library.' });
      return [];
    }

    try {
      this.onLog({ type: 'HARNESS', message: '[STEAM LIBRARY] Fetching your Steam library via Steam Web API...' });

      let data;
      if (typeof window !== 'undefined' && window.jarvisElectron?.isElectron) {
        // Running inside the Electron shell — fetch via the main process (plain
        // Node HTTPS request), which isn't subject to browser CORS at all.
        data = await window.jarvisElectron.fetchSteamLibrary(this.apiKey, this.steamId);
      } else {
        // Plain browser tab. Steam's API doesn't allow direct cross-origin
        // browser calls. In dev, route through Vite's own server proxy (see
        // vite.config.js) — no third-party dependency. In a built/static
        // deployment, fall back to a public CORS proxy (best-effort; these
        // are unreliable and can go down).
        const steamPath = `/IPlayerService/GetOwnedGames/v0001/?key=${this.apiKey}&steamid=${this.steamId}&include_appinfo=1&format=json`;
        const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
        const apiUrl = isDev
          ? `/steam-api${steamPath}`
          : `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.steampowered.com${steamPath}`)}`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        data = await response.json();
      }

      if (!data.response || !data.response.games) {
        throw new Error('Steam API returned no games. Check that your Steam profile games are set to Public.');
      }

      const games = data.response.games;
      this.library = games.map(g => ({
        appid: String(g.appid),
        name: g.name,
        nameLower: g.name.toLowerCase(),
        playtimeForever: g.playtime_forever || 0
      }));

      // Sort by most played first for better fuzzy match priority
      this.library.sort((a, b) => b.playtimeForever - a.playtimeForever);

      this.lastFetched = Date.now();
      this._saveCache(this.library);

      this.onLog({
        type: 'SUCCESS',
        message: `[STEAM LIBRARY] Loaded ${this.library.length} games from your Steam library.`
      });

      return this.library;
    } catch (err) {
      this.onLog({
        type: 'WARNING',
        message: `[STEAM LIBRARY] Failed to fetch library: ${err.message}`
      });
      return [];
    }
  }

  /**
   * Fuzzy-match a spoken game name to a Steam AppID.
   * Returns the best match or null.
   */
  findGame(query) {
    if (!this.library.length) return null;

    const q = query.trim().toLowerCase()
      .replace(/['']/g, "'")       // normalize smart quotes
      .replace(/[^a-z0-9\s':-]/g, ''); // strip punctuation

    let bestMatch = null;
    let bestScore = 0;

    for (const game of this.library) {
      const name = game.nameLower
        .replace(/['']/g, "'")
        .replace(/[^a-z0-9\s':-]/g, '');

      // Exact match
      if (name === q) {
        return game;
      }

      // Name contains the query
      if (name.includes(q)) {
        const score = q.length / name.length; // longer match = better score
        if (score > bestScore) {
          bestScore = score;
          bestMatch = game;
        }
        continue;
      }

      // Query contains the game name (e.g., saying full subtitle)
      if (q.includes(name)) {
        const score = name.length / q.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = game;
        }
        continue;
      }

      // Token overlap scoring
      const qTokens = new Set(q.split(/\s+/).filter(t => t.length > 2));
      const nameTokens = name.split(/\s+/).filter(t => t.length > 2);
      if (qTokens.size > 0 && nameTokens.length > 0) {
        const overlap = nameTokens.filter(t => qTokens.has(t)).length;
        const score = overlap / Math.max(qTokens.size, nameTokens.length);
        if (score >= 0.5 && score > bestScore) {
          bestScore = score;
          bestMatch = game;
        }
      }
    }

    return bestScore >= 0.5 ? bestMatch : null;
  }

  _saveCache(library) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify({
        ts: Date.now(),
        games: library
      }));
    } catch (e) {
      console.warn('Could not save Steam library cache:', e);
    }
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

  /**
   * Returns a few most-played games for quick-access display
   */
  getTopGames(limit = 6) {
    return this.library.slice(0, limit);
  }

  clearCache() {
    localStorage.removeItem(this.cacheKey);
    this.library = [];
    this.lastFetched = null;
    this.onLog({ type: 'HARNESS', message: '[STEAM LIBRARY] Cache cleared.' });
  }
}
