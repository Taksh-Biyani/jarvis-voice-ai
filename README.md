# J.A.R.V.I.S. Voice AI

A desktop voice assistant with wake-word listening ("Jarvis" / "Hey Jarvis"),
OpenRouter-powered conversation, Google search automation, and a Steam game
launcher — built as an Electron app with a HUD-style web UI.

## Setup

    npm install

### API keys

JARVIS works with zero configuration (it falls back to a small local
knowledge base and your OS's built-in speech recognition), but for real
conversational answers you'll want at least one of OpenRouter or Groq —
either is enough on its own, Groq is just faster. There are two ways to
provide keys:

1. **In-app (recommended)** — run the app, click **⚙️ SETTINGS** in the
   header, and paste keys into the API Keys section. Stored in the browser's
   localStorage; nothing leaves your machine except calls to the providers
   themselves.
2. **`.env` file** (baked in at build time):

       cp .env.example .env

   then fill in the values.

| Key | Required? | Get one at |
|---|---|---|
| `VITE_OPENROUTER_API_KEY` | One of OpenRouter or Groq — powers conversational answers | https://openrouter.ai/keys |
| `VITE_GROQ_API_KEY` | One of OpenRouter or Groq — much faster responses | https://console.groq.com/keys |
| `VITE_DEEPGRAM_API_KEY` | Optional — better speech recognition | https://console.deepgram.com |
| `VITE_STEAM_API_KEY` + `VITE_STEAM_ID` | Optional — launch games from your real library by name | https://steamcommunity.com/dev/apikey and https://steamid.io |

Steam credentials have their own setup box in the left panel of the app —
same idea, paste and save, no `.env` required.

## Settings

Click **⚙️ SETTINGS** in the header to configure:

- **Open browser tab when searching Google** — Y/N. When off, search
  results still appear in the in-app HUD viewport, just without also
  popping a new browser tab.
- **Voice gender** — Male / Female. Picks a matching system/browser TTS
  voice by name (the Web Speech API doesn't expose a real gender field, so
  this is a best-effort match against common voice names).
- **Voice output meter** — Y/N. Shows a small bar meter near the arc
  reactor that reacts while JARVIS is speaking. It approximates loudness
  from speech cadence (word boundaries), not a literal decibel reading —
  browsers don't expose an audio stream for built-in text-to-speech.
- **API Keys** — OpenRouter, Groq, and Deepgram, as described above.
  OpenRouter and Groq key changes apply immediately; a newly added Deepgram
  key requires restarting JARVIS to take effect.
- **Use Groq instead of OpenRouter** — Y/N. Groq's `llama-3.1-8b-instant` is
  much faster than OpenRouter's free model pool. This is only needed to
  *prefer* Groq when you have both keys set — if you only set a Groq key and
  no OpenRouter key, JARVIS already uses Groq automatically regardless of
  this switch. Either way, if Groq fails (rate-limited, network error),
  JARVIS falls back to OpenRouter (if configured), then to the local
  knowledge base — same as always.

## Running it

Dev mode needs two terminals — Vite serves the UI, Electron just points a
window at it:

    npm run dev        # terminal 1 — Vite dev server on localhost:3000
    npm run electron   # terminal 2 — opens the JARVIS window/tray

Or skip Electron and just open `http://localhost:3000` in Chrome/Edge —
everything works there too, except the Windows-speech-recognition bridge and
tray icon (the browser's own SpeechRecognition API is used instead).

## Building an installer

    npm run electron:build

Produces a Windows installer in `release/`.

## Tests

    npm test

Runs the `node --test` suite in `test/` — headless, no API keys or running
app required.
