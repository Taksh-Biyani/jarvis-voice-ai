import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchChatCompletion } from '../src/llm-completion.js';

function mockFetchOnce(responseBody) {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return {
      ok: true,
      json: async () => responseBody
    };
  };
  return calls;
}

test('fetchChatCompletion sends the default temperature and max_tokens when not specified', async () => {
  const calls = mockFetchOnce({ choices: [{ message: { content: 'hello' } }] });

  await fetchChatCompletion({
    baseUrl: 'https://example.test/chat',
    headers: {},
    modelQueue: ['some-model'],
    messages: [{ role: 'user', content: 'hi' }],
    logPrefix: 'TEST'
  });

  assert.equal(calls[0].body.temperature, 0.7);
  assert.equal(calls[0].body.max_tokens, 350);
});

test('fetchChatCompletion forwards a custom temperature and maxTokens through to the request body', async () => {
  const calls = mockFetchOnce({ choices: [{ message: { content: 'Elden Ring' } }] });

  const result = await fetchChatCompletion({
    baseUrl: 'https://example.test/chat',
    headers: {},
    modelQueue: ['some-model'],
    messages: [{ role: 'user', content: 'hi' }],
    logPrefix: 'TEST',
    temperature: 0.1,
    maxTokens: 30
  });

  assert.equal(calls[0].body.temperature, 0.1);
  assert.equal(calls[0].body.max_tokens, 30);
  assert.equal(result, 'Elden Ring');
});
