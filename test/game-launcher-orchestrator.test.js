import test from 'node:test';
import assert from 'node:assert/strict';
import { GameLauncherOrchestrator } from '../src/game-launcher-orchestrator.js';

function makeOrchestrator({ steamMatch, xboxGames, xboxMatch, epicGames, epicMatch }) {
  const calls = [];
  const steamHarness = {
    resolveGame: async (q) => { calls.push(`steam.resolveGame(${q})`); return steamMatch; },
    launchGame: async (q) => { calls.push(`steam.launchGame(${q})`); return { success: true, gameName: q, source: 'steam' }; }
  };
  const xboxLibrary = {
    fetchLibrary: async () => { calls.push('xbox.fetchLibrary'); return xboxGames || []; },
    findGame: (q) => { calls.push(`xbox.findGame(${q})`); return xboxMatch || null; }
  };
  const epicGamesLibrary = {
    fetchLibrary: async () => { calls.push('epic.fetchLibrary'); return epicGames || []; },
    findGame: (q) => { calls.push(`epic.findGame(${q})`); return epicMatch || null; }
  };
  const xboxHarness = { launchGame: async (q) => { calls.push(`xbox.launchGame(${q})`); return { success: true, gameName: q, source: 'xbox' }; } };
  const epicGamesHarness = { launchGame: async (q) => { calls.push(`epic.launchGame(${q})`); return { success: true, gameName: q, source: 'epic' }; } };

  const orchestrator = new GameLauncherOrchestrator({ steamHarness, xboxHarness, epicGamesHarness, xboxLibrary, epicGamesLibrary });
  return { orchestrator, calls };
}

test('a Steam match stops the chain immediately — Xbox and Epic are never consulted', async () => {
  const { orchestrator, calls } = makeOrchestrator({ steamMatch: { appId: '570', name: 'Dota 2', source: 'steam_library' } });

  const result = await orchestrator.launchGame('dota 2');

  assert.equal(result.source, 'steam');
  assert.deepEqual(calls, ['steam.resolveGame(dota 2)', 'steam.launchGame(dota 2)']);
});

test('a Steam miss + Xbox match launches via Xbox — Epic is never consulted', async () => {
  const { orchestrator, calls } = makeOrchestrator({
    steamMatch: null,
    xboxGames: [{ name: 'Hades II' }],
    xboxMatch: { name: 'Hades II', appId: 'abc!Game' }
  });

  const result = await orchestrator.launchGame('hades 2');

  assert.equal(result.source, 'xbox');
  assert.deepEqual(calls, ['steam.resolveGame(hades 2)', 'xbox.fetchLibrary', 'xbox.findGame(hades 2)', 'xbox.launchGame(hades 2)']);
});

test('a Steam + Xbox miss + Epic match launches via Epic', async () => {
  const { orchestrator, calls } = makeOrchestrator({
    steamMatch: null,
    xboxGames: [],
    epicGames: [{ name: 'Fortnite' }],
    epicMatch: { name: 'Fortnite' }
  });

  const result = await orchestrator.launchGame('fortnite');

  assert.equal(result.source, 'epic');
  assert.deepEqual(calls, ['steam.resolveGame(fortnite)', 'xbox.fetchLibrary', 'epic.fetchLibrary', 'epic.findGame(fortnite)', 'epic.launchGame(fortnite)']);
});

test('a miss everywhere falls through to steamHarness.launchGame (its own Store-search fallback)', async () => {
  const { orchestrator, calls } = makeOrchestrator({ steamMatch: null, xboxGames: [], epicGames: [] });

  const result = await orchestrator.launchGame('some totally unowned title');

  assert.equal(result.source, 'steam');
  assert.deepEqual(calls, [
    'steam.resolveGame(some totally unowned title)',
    'xbox.fetchLibrary',
    'epic.fetchLibrary',
    'steam.launchGame(some totally unowned title)'
  ]);
});

test('an empty (non-null) Xbox library skips straight to fetching Epic without calling xbox.findGame', async () => {
  const { orchestrator, calls } = makeOrchestrator({ steamMatch: null, xboxGames: [], epicGames: [{ name: 'Fortnite' }], epicMatch: { name: 'Fortnite' } });

  await orchestrator.launchGame('fortnite');

  assert.ok(!calls.includes('xbox.findGame(fortnite)'), 'should not call findGame against an empty library');
});
