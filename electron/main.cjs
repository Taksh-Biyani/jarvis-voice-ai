const { app, BrowserWindow, Tray, Menu, shell, session, ipcMain, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const { classifyUpdate } = require('./update-classify.cjs');

const DEV_URL = 'http://localhost:3000';
const ICON_PATH = path.join(__dirname, 'icon.png');
const SPEECH_SCRIPT_PATH = path.join(__dirname, 'speech-recognizer.ps1');

let mainWindow = null;
let tray = null;
let micProcess = null;
app.isQuitting = false;

// Auto-download only kicks in for major bumps (see update-classify.cjs) —
// minor/patch updates wait for an explicit renderer-triggered download.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
let pendingUpdate = null; // { version, classification } once update-available fires
let updateReadyToInstall = false;

// Only one JARVIS instance/tray icon at a time.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'J.A.R.V.I.S.',
    icon: ICON_PATH,
    backgroundColor: '#05070c',
    autoHideMenuBar: true,
    // Start hidden — JARVIS lives in the tray and listens in the background;
    // the window only appears when the user opens it from the tray icon.
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL(DEV_URL);
  }

  if (!app.isPackaged) {
    // Surface renderer console output in the main-process terminal for debugging.
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[renderer] ${message}`);
    });
  }

  // steam:// (and any other non-http) links must go to the OS, not Electron's
  // own navigation — Electron won't resolve custom protocols like a real browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // window.open() calls (Google search tabs, Store search fallback, site links)
  // should open in the user's default browser, not spawn a second Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Closing the window minimizes to tray instead of quitting the app.
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH);
  tray = new Tray(icon.isEmpty() ? icon : icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('J.A.R.V.I.S. Voice AI');

  const menu = Menu.buildFromTemplate([
    { label: 'Show JARVIS', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function configureAutoLaunch() {
  // Only meaningful for an installed build — dev runs point at the Electron
  // binary itself, which isn't something useful to auto-launch at login.
  if (!app.isPackaged) return;
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath
  });
}

// Voice input: Electron's Chromium build has no proprietary Google speech
// backend, so the browser's SpeechRecognition API always fails with a
// "network" error here. Instead, run Windows' own on-device dictation
// (System.Speech via PowerShell) in a child process and stream results back
// over IPC — free, local/private, no API key, works offline.
function stopMic(notifyRenderer = false) {
  if (micProcess) {
    try { micProcess.kill(); } catch (e) {}
    micProcess = null;
  }
  if (notifyRenderer && mainWindow) {
    mainWindow.webContents.send('mic:status', { status: 'stopped', message: 'Voice listening paused' });
  }
}

function startMic() {
  if (micProcess) return; // already running

  micProcess = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SPEECH_SCRIPT_PATH
  ], { windowsHide: true });

  let buffer = '';
  micProcess.stdout.setEncoding('utf8');
  micProcess.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch (e) {
        continue; // ignore any non-JSON PowerShell noise
      }

      if (!mainWindow) continue;

      if (msg.type === 'ready') {
        mainWindow.webContents.send('mic:status', { status: 'listening', message: 'Listening for voice input (Windows Speech)...' });
      } else if (msg.type === 'final' || msg.type === 'interim') {
        mainWindow.webContents.send('mic:transcript', { text: msg.text, isFinal: msg.type === 'final' });
      } else if (msg.type === 'error') {
        mainWindow.webContents.send('mic:status', { status: 'error', message: `Windows Speech Recognition error: ${msg.message}` });
        stopMic();
      }
    }
  });

  micProcess.stderr.setEncoding('utf8');
  micProcess.stderr.on('data', (chunk) => {
    console.warn('[speech-recognizer stderr]', chunk);
  });

  micProcess.on('exit', (code) => {
    const hadProcess = micProcess !== null;
    micProcess = null;
    if (hadProcess && code !== 0 && code !== null && mainWindow) {
      mainWindow.webContents.send('mic:status', {
        status: 'error',
        message: `Windows Speech Recognition exited unexpectedly (code ${code}). Check that Windows Speech Recognition is available on this PC, then click the mic button to retry.`
      });
    }
  });

  micProcess.on('error', (err) => {
    micProcess = null;
    if (mainWindow) {
      mainWindow.webContents.send('mic:status', { status: 'error', message: `Failed to start Windows Speech Recognition: ${err.message}` });
    }
  });
}

function registerMicIpc() {
  ipcMain.handle('mic:start', () => { startMic(); });
  ipcMain.handle('mic:stop', () => { stopMic(true); });
}

function registerSteamIpc() {
  // Runs in the main process, so it's a plain Node HTTPS request — not subject
  // to browser CORS at all. Replaces the dev-only Vite proxy / public CORS
  // proxy fallback used when this app runs as a regular browser tab.
  ipcMain.handle('steam:fetch-owned-games', (event, { apiKey, steamId }) => {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}&include_appinfo=1&format=json`;
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunkData) => { data += chunkData; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error('Invalid JSON returned from Steam API'));
            }
          } else {
            reject(new Error(`Steam API HTTP ${res.statusCode}`));
          }
        });
      }).on('error', reject);
    });
  });
}

function registerWolframIpc() {
  // Same plain-Node-HTTPS-in-main-process trick as registerSteamIpc, to avoid
  // browser CORS entirely for the packaged app.
  ipcMain.handle('wolfram:solve', (event, { appId, query }) => {
    const url = `https://api.wolframalpha.com/v1/spoken?appid=${encodeURIComponent(appId)}&i=${encodeURIComponent(query)}`;
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunkData) => { data += chunkData; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else if (res.statusCode === 501) {
            // WolframAlpha's documented response code for "no spoken result
            // available for this query" — not an error, just no answer.
            resolve(null);
          } else {
            reject(new Error(`WolframAlpha API HTTP ${res.statusCode}`));
          }
        });
      }).on('error', reject);
    });
  });
}

function registerSpotifyIpc() {
  // Client Credentials token exchange requires POSTing a client secret —
  // this must stay in the main process rather than going through the public
  // CORS proxy Steam/Wolfram use in a plain browser tab, since that proxy is
  // fine for a public app ID but not for a real secret.
  ipcMain.handle('spotify:resolve-track', (event, { clientId, clientSecret, query }) => {
    return new Promise((resolve, reject) => {
      const tokenBody = 'grant_type=client_credentials';
      const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const tokenReq = https.request('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(tokenBody)
        }
      }, (tokenRes) => {
        let tokenData = '';
        tokenRes.on('data', (chunk) => { tokenData += chunk; });
        tokenRes.on('end', () => {
          if (tokenRes.statusCode !== 200) {
            reject(new Error(`Spotify token HTTP ${tokenRes.statusCode}`));
            return;
          }

          let accessToken;
          try {
            accessToken = JSON.parse(tokenData).access_token;
          } catch (e) {
            reject(new Error('Invalid Spotify token response'));
            return;
          }

          const searchUrl = `https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(query)}`;
          https.get(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } }, (searchRes) => {
            let searchData = '';
            searchRes.on('data', (chunk) => { searchData += chunk; });
            searchRes.on('end', () => {
              if (searchRes.statusCode !== 200) {
                reject(new Error(`Spotify search HTTP ${searchRes.statusCode}`));
                return;
              }

              try {
                const parsed = JSON.parse(searchData);
                const track = parsed.tracks?.items?.[0];
                resolve(track ? {
                  uri: track.uri,
                  name: track.name,
                  artist: track.artists?.[0]?.name || ''
                } : null);
              } catch (e) {
                reject(new Error('Invalid Spotify search response'));
              }
            });
          }).on('error', reject);
        });
      });

      tokenReq.on('error', reject);
      tokenReq.write(tokenBody);
      tokenReq.end();
    });
  });
}

function sendUpdateState(state) {
  if (mainWindow) mainWindow.webContents.send('update:state', state);
}

function registerUpdaterEvents() {
  autoUpdater.on('checking-for-update', () => {
    sendUpdateState({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    const classification = classifyUpdate(app.getVersion(), info.version);
    pendingUpdate = { version: info.version, classification };

    if (classification === 'major') {
      // Major bumps auto-download silently — no click needed until install.
      sendUpdateState({ status: 'downloading', version: info.version, classification, progress: 0 });
      autoUpdater.downloadUpdate();
    } else {
      // Minor/patch bumps surface passively; download waits for update:download.
      sendUpdateState({ status: 'available', version: info.version, classification });
    }
  });

  autoUpdater.on('update-not-available', () => {
    pendingUpdate = null;
    sendUpdateState({ status: 'idle' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateState({
      status: 'downloading',
      version: pendingUpdate?.version,
      classification: pendingUpdate?.classification,
      progress: Math.round(progress.percent)
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateReadyToInstall = true;
    sendUpdateState({ status: 'ready', version: info.version, classification: pendingUpdate?.classification });
  });

  autoUpdater.on('error', (err) => {
    // A failed silent launch check shouldn't alarm the user — it just logs
    // to the terminal panel via the renderer's console-message bridge and
    // leaves the UI at whatever state it was already in (usually 'idle').
    console.warn('[autoUpdater]', err?.message || err);
    sendUpdateState({ status: 'error', message: err?.message || 'Update check failed' });
  });
}

function registerUpdateIpc() {
  ipcMain.handle('update:get-version', () => app.getVersion());

  ipcMain.handle('update:check', () => {
    if (!app.isPackaged) {
      // Dev builds have no publish feed to compare against — report idle
      // instead of letting electron-updater throw on a missing app-update.yml.
      sendUpdateState({ status: 'idle' });
      return;
    }
    autoUpdater.checkForUpdates();
  });

  ipcMain.handle('update:download', () => {
    if (pendingUpdate) autoUpdater.downloadUpdate();
  });

  ipcMain.handle('update:install', () => {
    if (updateReadyToInstall) autoUpdater.quitAndInstall();
  });
}

app.whenReady().then(() => {
  // Grant microphone access automatically — this is a trusted first-party app,
  // and the voice pipeline is core functionality, not an optional feature.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });

  registerSteamIpc();
  registerMicIpc();
  registerWolframIpc();
  registerSpotifyIpc();
  registerUpdaterEvents();
  registerUpdateIpc();
  createWindow();
  createTray();
  configureAutoLaunch();

  if (app.isPackaged) {
    // Silent launch check — errors (offline, rate-limited) are swallowed by
    // the 'error' handler above rather than surfaced as a popup.
    autoUpdater.checkForUpdates().catch(() => {});
  }

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Intentionally not quitting — JARVIS keeps running in the tray on Windows.
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopMic();
});
