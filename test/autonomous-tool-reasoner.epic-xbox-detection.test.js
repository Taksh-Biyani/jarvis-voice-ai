import test from 'node:test';
import assert from 'node:assert/strict';
import { AutonomousToolReasoner } from '../src/autonomous-tool-reasoner.js';

const reasoner = new AutonomousToolReasoner();

const epicOpenCases = [
  'open epic games',
  'launch epic games',
  'start epic',
  'epic games',
  'epic',
  'open epic games launcher'
];

for (const query of epicOpenCases) {
  test(`classifies "${query}" as EPIC_OPEN_CLIENT`, () => {
    const decision = reasoner.evaluateIntent(query);
    assert.equal(decision.toolName, 'EPIC_OPEN_CLIENT');
  });
}

const xboxOpenCases = [
  'open xbox',
  'launch xbox app',
  'start xbox',
  'xbox'
];

for (const query of xboxOpenCases) {
  test(`classifies "${query}" as XBOX_OPEN_CLIENT`, () => {
    const decision = reasoner.evaluateIntent(query);
    assert.equal(decision.toolName, 'XBOX_OPEN_CLIENT');
  });
}

test('bare "play <game>" still routes to Steam, not Epic/Xbox (regression)', () => {
  const decision = reasoner.evaluateIntent('play Cyberpunk 2077');
  assert.equal(decision.toolName, 'STEAM_LAUNCH_GAME');
});

test('"open epic games launcher" does not fall through to the Steam broad-launch fallback', () => {
  const decision = reasoner.evaluateIntent('open epic games launcher');
  assert.equal(decision.toolName, 'EPIC_OPEN_CLIENT');
});

test('"open xbox" does not fall through to the Steam broad-launch fallback', () => {
  const decision = reasoner.evaluateIntent('open xbox');
  assert.equal(decision.toolName, 'XBOX_OPEN_CLIENT');
});
