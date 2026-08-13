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

test('fetchChatCompletion strips a closed <think>...</think> block and returns only the final answer', async () => {
  mockFetchOnce({ choices: [{ message: { content: '<think>let me work this out...</think>The answer is 1458.' } }] });

  const result = await fetchChatCompletion({
    baseUrl: 'https://example.test/chat',
    headers: {},
    modelQueue: ['some-reasoning-model'],
    messages: [{ role: 'user', content: 'what is 27 times 54' }],
    logPrefix: 'TEST'
  });

  assert.equal(result, 'The answer is 1458.');
});

test('fetchChatCompletion treats an unclosed <think> block (ran out of tokens mid-thought) as empty and tries the next model', async () => {
  const calls = [];
  let call = 0;
  global.fetch = async (url, init) => {
    call += 1;
    calls.push({ url, body: JSON.parse(init.body) });
    if (call === 1) {
      return { ok: true, json: async () => ({ choices: [{ message: { content: '<think>still reasoning and never finished' } }] }) };
    }
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'The answer is 1458.' } }] }) };
  };

  const result = await fetchChatCompletion({
    baseUrl: 'https://example.test/chat',
    headers: {},
    modelQueue: ['reasoning-model-that-truncates', 'backup-model'],
    messages: [{ role: 'user', content: 'what is 27 times 54' }],
    logPrefix: 'TEST'
  });

  assert.equal(result, 'The answer is 1458.');
  assert.equal(calls.length, 2);
});
