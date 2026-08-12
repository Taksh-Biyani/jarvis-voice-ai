import test from 'node:test';
import assert from 'node:assert/strict';

global.window = global.window || {};

const { EpicGamesHarness } = await import('../src/epic-games-harness.js');

function resetWindow() {
  global.window = { location: { href: '' } };
}

test('openApp navigates to the com.epicgames.launcher://start URI and reports success', () => {
  resetWindow();
  const harness = new EpicGamesHarness();
  const result = harness.openApp();

  assert.equal(global.window.location.href, 'com.epicgames.launcher://start');
  assert.equal(result.success, true);
});
