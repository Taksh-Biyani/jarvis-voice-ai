import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL_TIERS, TIER_ORDER, normalizeTierAlias } from '../src/model-tiers.js';

test('MODEL_TIERS has all four tiers with a model id and label', () => {
  for (const key of ['quick', 'medium', 'high', 'ultra']) {
    assert.ok(MODEL_TIERS[key].model, `${key} has a model id`);
    assert.ok(MODEL_TIERS[key].label, `${key} has a label`);
  }
});

test('TIER_ORDER lists all four tiers in ascending order', () => {
  assert.deepEqual(TIER_ORDER, ['quick', 'medium', 'high', 'ultra']);
});

const aliasCases = [
  ['quick', 'quick'], ['low', 'quick'], ['fast', 'quick'],
  ['medium', 'medium'], ['mid', 'medium'],
  ['high', 'high'],
  ['ultra', 'ultra'], ['max', 'ultra'], ['maximum', 'ultra'],
  ['QUICK', 'quick'], ['High', 'high']
];

for (const [word, expected] of aliasCases) {
  test(`normalizeTierAlias("${word}") -> "${expected}"`, () => {
    assert.equal(normalizeTierAlias(word), expected);
  });
}

test('normalizeTierAlias returns null for unrecognized words', () => {
  assert.equal(normalizeTierAlias('insane'), null);
  assert.equal(normalizeTierAlias(''), null);
  assert.equal(normalizeTierAlias(null), null);
});
