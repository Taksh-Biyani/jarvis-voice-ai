import test from 'node:test';
import assert from 'node:assert/strict';
import { GroqClient } from '../src/groq-client.js';

function mockFetchOnce(responseBody) {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => responseBody };
  };
  return calls;
}

test('generateVisionCompletion uses the dedicated vision model queue, not the text modelQueue', async () => {
  const calls = mockFetchOnce({ choices: [{ message: { content: 'A terminal window.' } }] });
  const client = new GroqClient('fake-key');

  const result = await client.generateVisionCompletion([{ role: 'user', content: 'what is this?' }], { temperature: 0.3, maxTokens: 200 });

  assert.equal(result, 'A terminal window.');
  assert.equal(calls[0].body.model, client.visionModelQueue[0]);
  assert.notEqual(client.visionModelQueue[0], client.modelQueue[0]);
});

test('generateVisionCompletion throws when no API key is configured', async () => {
  const client = new GroqClient('');
  await assert.rejects(() => client.generateVisionCompletion([{ role: 'user', content: 'hi' }]), /API Key not configured/);
});
