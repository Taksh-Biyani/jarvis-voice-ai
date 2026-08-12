import test from 'node:test';
import assert from 'node:assert/strict';

global.window = global.window || {};

const { XboxHarness } = await import('../src/xbox-harness.js');

function resetWindow(overrides = {}) {
  global.window = { location: { href: '' }, ...overrides };
}

test('openApp navigates to the xbox: URI and reports success', () => {
  resetWindow();
  const harness = new XboxHarness();
  const result = harness.openApp();

  assert.equal(global.window.location.href, 'xbox:');
  assert.equal(result.success, true);
});

test('launchGame resolves via the injected XboxLibrary and calls the Electron launch bridge', async () => {
  resetWindow({
    jarvisElectron: {
      isElectron: true,
      xboxLaunchApp: async (appId) => { global.window.__lastLaunchedAppId = appId; return { success: true }; }
    }
  });
  const xboxLibrary = {
    fetchLibrary: async () => ([{ name: 'Hades II', appId: 'SupergiantGamesLLC.HadesII_q53c1yqmx7pha!Game' }]),
    findGame: (q) => (q.toLowerCase().includes('hades') ? { name: 'Hades II', appId: 'SupergiantGamesLLC.HadesII_q53c1yqmx7pha!Game' } : null)
  };
  const harness = new XboxHarness({ xboxLibrary });

  const result = await harness.launchGame('hades 2');

  assert.equal(result.success, true);
  assert.equal(result.gameName, 'Hades II');
  assert.equal(global.window.__lastLaunchedAppId, 'SupergiantGamesLLC.HadesII_q53c1yqmx7pha!Game');
});

test('launchGame reports failure without calling the launch bridge when no match is found', async () => {
  resetWindow({ jarvisElectron: { isElectron: true, xboxLaunchApp: async () => { throw new Error('should not be called'); } } });
  const xboxLibrary = {
    fetchLibrary: async () => ([]),
    findGame: () => null
  };
  const harness = new XboxHarness({ xboxLibrary });

  const result = await harness.launchGame('some totally unowned title');

  assert.equal(result.success, false);
});

test('launchGame reports failure when not running inside Electron, even with a match', async () => {
  resetWindow();
  const xboxLibrary = {
    fetchLibrary: async () => ([{ name: 'Hades II', appId: 'abc!Game' }]),
    findGame: () => ({ name: 'Hades II', appId: 'abc!Game' })
  };
  const harness = new XboxHarness({ xboxLibrary });

  const result = await harness.launchGame('hades 2');

  assert.equal(result.success, false);
});
