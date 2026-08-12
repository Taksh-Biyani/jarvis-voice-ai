import test from 'node:test';
import assert from 'node:assert/strict';

global.window = global.window || {};

const { XboxHarness } = await import('../src/xbox-harness.js');

function resetWindow() {
  global.window = { location: { href: '' } };
}

test('openApp navigates to the xbox: URI and reports success', () => {
  resetWindow();
  const harness = new XboxHarness();
  const result = harness.openApp();

  assert.equal(global.window.location.href, 'xbox:');
  assert.equal(result.success, true);
});
