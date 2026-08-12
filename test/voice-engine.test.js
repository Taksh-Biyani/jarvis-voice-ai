import test from 'node:test';
import assert from 'node:assert/strict';

global.localStorage = global.localStorage || {
  store: new Map(),
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; },
  setItem(key, val) { this.store.set(key, String(val)); },
  removeItem(key) { this.store.delete(key); }
};

class FakeSpeechRecognition {
  constructor() {
    this.maxAlternatives = 1;
  }
  start() {}
  stop() {}
}

function makeWindow() {
  return {
    SpeechRecognition: FakeSpeechRecognition,
    speechSynthesis: { getVoices: () => [] }
  };
}

const { VoiceEngine } = await import('../src/voice-engine.js');

test('browser engine requests 3 alternatives from the recognizer', () => {
  global.window = makeWindow();
  const engine = new VoiceEngine({ onTranscript: () => {} });

  assert.equal(engine.recognition.maxAlternatives, 3);
});

test('browser engine passes runner-up transcripts through onTranscript.alternatives on a final result', () => {
  global.window = makeWindow();
  const transcripts = [];
  const engine = new VoiceEngine({ onTranscript: (t) => transcripts.push(t) });

  engine.recognition.onresult({
    resultIndex: 0,
    results: [
      Object.assign(
        [{ transcript: 'launch elden ring' }, { transcript: 'launch eldn ring' }, { transcript: 'launch elder ring' }],
        { isFinal: true }
      )
    ]
  });

  assert.equal(transcripts.length, 1);
  assert.equal(transcripts[0].text, 'launch elden ring');
  assert.equal(transcripts[0].isFinal, true);
  assert.deepEqual(transcripts[0].alternatives, ['launch eldn ring', 'launch elder ring']);
});

test('browser engine reports an empty alternatives array when the recognizer returns only one guess', () => {
  global.window = makeWindow();
  const transcripts = [];
  const engine = new VoiceEngine({ onTranscript: (t) => transcripts.push(t) });

  engine.recognition.onresult({
    resultIndex: 0,
    results: [
      Object.assign([{ transcript: 'open steam' }], { isFinal: true })
    ]
  });

  assert.deepEqual(transcripts[0].alternatives, []);
});

test('interim (non-final) results report no alternatives', () => {
  global.window = makeWindow();
  const transcripts = [];
  const engine = new VoiceEngine({ onTranscript: (t) => transcripts.push(t) });

  engine.recognition.onresult({
    resultIndex: 0,
    results: [
      Object.assign([{ transcript: 'launch el' }, { transcript: 'launch elle' }], { isFinal: false })
    ]
  });

  assert.equal(transcripts.length, 1);
  assert.equal(transcripts[0].isFinal, false);
  assert.deepEqual(transcripts[0].alternatives, []);
});
