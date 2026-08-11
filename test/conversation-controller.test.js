import test from 'node:test';
import assert from 'node:assert/strict';
import { ConversationController } from '../src/conversation-controller.js';

test('wake word + command in one breath dispatches immediately and starts a conversation', () => {
  const controller = new ConversationController();

  const result = controller.handleTranscript('Hey Jarvis, play Dota');

  assert.deepEqual(result, { action: 'DISPATCH_COMMAND', command: 'play Dota', conversationStarting: true, chime: true });
  assert.equal(controller.isConversationActive, true);
  assert.equal(controller.isAwaitingCommand, false);
});

test('wake word alone awaits a command, then the next utterance dispatches it', () => {
  const controller = new ConversationController();

  const first = controller.handleTranscript('Jarvis');
  assert.deepEqual(first, { action: 'AWAIT_COMMAND' });
  assert.equal(controller.isAwaitingCommand, true);

  const second = controller.handleTranscript('what time is it');
  assert.deepEqual(second, { action: 'DISPATCH_COMMAND', command: 'what time is it', conversationStarting: true, chime: false });
  assert.equal(controller.isAwaitingCommand, false);
  assert.equal(controller.isConversationActive, true);
});

test('onWakeTimeout clears awaitingCommand without starting a conversation', () => {
  const controller = new ConversationController();

  controller.handleTranscript('Jarvis');
  assert.equal(controller.isAwaitingCommand, true);

  controller.onWakeTimeout();

  assert.equal(controller.isAwaitingCommand, false);
  assert.equal(controller.isConversationActive, false);
});

test('while a conversation is active, a plain command needs no wake word', () => {
  const controller = new ConversationController();

  controller.handleTranscript('Hey Jarvis, play Dota'); // starts conversation
  const result = controller.handleTranscript('now pause it');

  assert.deepEqual(result, { action: 'DISPATCH_COMMAND', command: 'now pause it', conversationStarting: false, chime: false });
  assert.equal(controller.isConversationActive, true);
});

test('while a conversation is active, saying the wake word out of habit still works', () => {
  const controller = new ConversationController();

  controller.handleTranscript('Hey Jarvis, play Dota');
  const result = controller.handleTranscript('Jarvis, now pause it');

  assert.deepEqual(result, { action: 'DISPATCH_COMMAND', command: 'now pause it', conversationStarting: false, chime: false });
});
