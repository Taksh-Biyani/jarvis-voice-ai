import test from 'node:test';
import assert from 'node:assert/strict';

global.window = global.window || {};
global.localStorage = global.localStorage || {
  store: new Map(),
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; },
  setItem(key, val) { this.store.set(key, String(val)); },
  removeItem(key) { this.store.delete(key); }
};

const { SteamHarness } = await import('../src/steam-harness.js');

function resetWindow() {
  global.window = { location: { href: '' }, open: () => {} };
}

test('resolveGame returns a steam_library match when the configured library has it', async () => {
  resetWindow();
  const harness = new SteamHarness();
  harness.steamLibrary = {
    isConfigured: () => true,
    library: [{ appid: '570', name: 'Dota 2', nameLower: 'dota 2' }],
    fetchLibrary: async () => {},
    findGame: (q) => (q.toLowerCase().includes('dota') ? { appid: '570', name: 'Dota 2' } : null)
  };

  const resolved = await harness.resolveGame('dota');
  assert.deepEqual(resolved, { appId: '570', name: 'Dota 2', source: 'steam_library' });
});

test('resolveGame falls back to the hardcoded dictionary when the library has no match', async () => {
  resetWindow();
  const harness = new SteamHarness();
  harness.steamLibrary = { isConfigured: () => false };

  const resolved = await harness.resolveGame('dota 2');
  assert.equal(resolved.source, 'dict');
  assert.equal(resolved.appId, '570');
});

test('resolveGame returns null when nothing matches anywhere', async () => {
  resetWindow();
  const harness = new SteamHarness();
  harness.steamLibrary = { isConfigured: () => false };

  const resolved = await harness.resolveGame('some totally unowned unreleased title');
  assert.equal(resolved, null);
});

test('launchGame uses resolveGame and navigates to steam://run/<appId> on a match', async () => {
  resetWindow();
  const harness = new SteamHarness();
  harness.steamLibrary = { isConfigured: () => false };

  const result = await harness.launchGame('dota 2');
  assert.equal(result.success, true);
  assert.equal(result.appId, '570');
  assert.equal(global.window.location.href, 'steam://run/570');
});

test('launchGame falls back to the Steam Store search when resolveGame finds nothing', async () => {
  resetWindow();
  let openedUrl = null;
  global.window.open = (url) => { openedUrl = url; };
  const harness = new SteamHarness();
  harness.steamLibrary = { isConfigured: () => false };

  const result = await harness.launchGame('some totally unowned unreleased title');
  assert.equal(result.success, false);
  assert.ok(openedUrl.startsWith('https://store.steampowered.com/search/?term='));
});
