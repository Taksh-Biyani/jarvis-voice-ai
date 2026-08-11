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
