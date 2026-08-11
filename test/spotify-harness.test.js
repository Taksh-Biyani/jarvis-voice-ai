import test from 'node:test';
import assert from 'node:assert/strict';

global.window = global.window || {};

const { SpotifyHarness } = await import('../src/spotify-harness.js');

function resetWindow() {
  global.window = { location: { href: '' } };
}

test('openApp navigates to the spotify: URI and reports success', () => {
  resetWindow();
  const harness = new SpotifyHarness();
  const result = harness.openApp();

  assert.equal(global.window.location.href, 'spotify:');
  assert.equal(result.success, true);
});

test('playSong falls back to spotify:search when no credentials are configured', async () => {
  resetWindow();
  const harness = new SpotifyHarness();
  const result = await harness.playSong('believer', '', '');

  assert.equal(global.window.location.href, `spotify:search:${encodeURIComponent('believer')}`);
  assert.equal(result.success, false);
  assert.equal(result.usedFallback, true);
  assert.equal(result.query, 'believer');
});

test('playSong falls back to spotify:search when not running inside Electron, even with credentials', async () => {
  resetWindow();
  const harness = new SpotifyHarness();
  const result = await harness.playSong('believer', 'client-id', 'client-secret');

  assert.equal(global.window.location.href, `spotify:search:${encodeURIComponent('believer')}`);
  assert.equal(result.usedFallback, true);
});

test('playSong navigates to the resolved track URI and speaks the real name/artist when a match is found', async () => {
  resetWindow();
  global.window.jarvisElectron = {
    isElectron: true,
    spotifyResolveTrack: async () => ({
      uri: 'spotify:track:abc123',
      name: 'Believer',
      artist: 'Imagine Dragons'
    })
  };
  const harness = new SpotifyHarness();
  const result = await harness.playSong('believer', 'client-id', 'client-secret');

  assert.equal(global.window.location.href, 'spotify:track:abc123');
  assert.equal(result.success, true);
  assert.equal(result.trackName, 'Believer');
  assert.equal(result.artist, 'Imagine Dragons');
  assert.match(result.message, /Believer/);
  assert.match(result.message, /Imagine Dragons/);
});

test('playSong falls back to spotify:search when the resolver finds no match', async () => {
  resetWindow();
  global.window.jarvisElectron = {
    isElectron: true,
    spotifyResolveTrack: async () => null
  };
  const harness = new SpotifyHarness();
  const result = await harness.playSong('some obscure unreleased track', 'client-id', 'client-secret');

  assert.equal(global.window.location.href, `spotify:search:${encodeURIComponent('some obscure unreleased track')}`);
  assert.equal(result.usedFallback, true);
});

test('playSong falls back to spotify:search when the resolver throws (network/auth error)', async () => {
  resetWindow();
  global.window.jarvisElectron = {
    isElectron: true,
    spotifyResolveTrack: async () => { throw new Error('Spotify token HTTP 400'); }
  };
  const harness = new SpotifyHarness();
  const result = await harness.playSong('believer', 'bad-id', 'bad-secret');

  assert.equal(global.window.location.href, `spotify:search:${encodeURIComponent('believer')}`);
  assert.equal(result.usedFallback, true);
});
