const WAKE_WORD_REGEX = /^(?:hey[,]?\s+)?jarvis\b[,!.\s]*/i;
const STOP_PHRASE_REGEX =
  /^(?:(?:hey[,]?\s+)?jarvis[,!.\s]*)?(?:stop conversation|end conversation|that['’]?s all|goodbye jarvis)[.!]?\s*$/i;

export class ConversationController {
  constructor({ wakeTimeoutMs = 8000, conversationTimeoutMs = 120000 } = {}) {
    this.wakeTimeoutMs = wakeTimeoutMs;
    this.conversationTimeoutMs = conversationTimeoutMs;
    this._awaitingCommand = false;
    this._conversationActive = false;
  }

  get isAwaitingCommand() {
    return this._awaitingCommand;
  }

  get isConversationActive() {
    return this._conversationActive;
  }

  handleTranscript(text) {
    if (this._conversationActive) {
      if (STOP_PHRASE_REGEX.test(text.trim())) {
        this._conversationActive = false;
        return { action: 'END_CONVERSATION' };
      }
      const command = text.replace(WAKE_WORD_REGEX, '').trim() || text.trim();
      return { action: 'DISPATCH_COMMAND', command, conversationStarting: false, chime: false };
    }

    if (this._awaitingCommand) {
      this._awaitingCommand = false;
      this._conversationActive = true;
      const command = text.replace(WAKE_WORD_REGEX, '').trim() || text.trim();
      return { action: 'DISPATCH_COMMAND', command, conversationStarting: true, chime: false };
    }

    const wakeMatch = text.match(WAKE_WORD_REGEX);
    if (!wakeMatch) {
      return { action: 'IGNORE' };
    }

    const command = text.slice(wakeMatch[0].length).trim();
    if (command) {
      this._conversationActive = true;
      return { action: 'DISPATCH_COMMAND', command, conversationStarting: true, chime: true };
    }

    this._awaitingCommand = true;
    return { action: 'AWAIT_COMMAND' };
  }

  onWakeTimeout() {
    this._awaitingCommand = false;
  }

  onConversationTimeout() {
    this._conversationActive = false;
  }

  reset() {
    this._awaitingCommand = false;
    this._conversationActive = false;
  }
}