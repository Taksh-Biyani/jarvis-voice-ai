/**
 * JARVIS Spotify Automation Harness
 * Opens the Spotify desktop app and plays songs via the `spotify:` URI
 * protocol. Exact-track resolution (auto-play) requires an optional Spotify
 * API key and Electron's main process (see spotifyResolveTrack in preload);
 * without either, falls back to opening Spotify pre-searched for the query.
 */

export class SpotifyHarness {
  constructor(options = {}) {
    this.onLog = options.onLog || (() => {});
  }

  /**
   * Opens the Spotify desktop application via its URI protocol handler.
   */
  openApp() {
    this.onLog({
      type: 'HARNESS',
      message: '[SPOTIFY HARNESS] Initiating Spotify Application launch protocol...'
    });

    window.location.href = 'spotify:';

    return {
      success: true,
      message: 'Opening Spotify, Sir.'
    };
  }

  /**
   * Opens Spotify pre-searched for the query. Used whenever exact-track
   * resolution isn't possible or didn't find a match — never a dead end.
   */
  _openSearchFallback(query) {
    const spotifyUri = `spotify:search:${encodeURIComponent(query)}`;
    this.onLog({
      type: 'HARNESS',
      message: `[SPOTIFY HARNESS] Opening Spotify search for "${query}" (${spotifyUri})`
    });

    window.location.href = spotifyUri;

    return {
      success: false,
      usedFallback: true,
      query,
      message: `I've opened Spotify search for "${query}", Sir.`
    };
  }

  /**
   * Resolves a song query to a track and plays it. With credentials and
   * running inside Electron, resolves the exact track via Spotify's Search
   * API and plays it directly. Otherwise falls back to opening Spotify
   * pre-searched for the query.
   */
  async playSong(query, clientId, clientSecret) {
    if (!clientId || !clientSecret || typeof window === 'undefined' || !window.jarvisElectron?.isElectron) {
      return this._openSearchFallback(query);
    }

    try {
      const track = await window.jarvisElectron.spotifyResolveTrack(clientId, clientSecret, query);
      if (!track) {
        return this._openSearchFallback(query);
      }

      this.onLog({
        type: 'SUCCESS',
        message: `[SPOTIFY MATCH] "${track.name}" by ${track.artist} (${track.uri})`
      });

      window.location.href = track.uri;

      return {
        success: true,
        trackName: track.name,
        artist: track.artist,
        uri: track.uri,
        message: `Playing "${track.name}" by ${track.artist}, Sir.`
      };
    } catch (err) {
      this.onLog({ type: 'WARNING', message: `[SPOTIFY FALLBACK] ${err.message}` });
      return this._openSearchFallback(query);
    }
  }
}
