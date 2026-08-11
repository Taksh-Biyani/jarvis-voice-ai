const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvisElectron', {
  isElectron: true,
  fetchSteamLibrary: (apiKey, steamId) => ipcRenderer.invoke('steam:fetch-owned-games', { apiKey, steamId }),
  solveMath: (appId, query) => ipcRenderer.invoke('wolfram:solve', { appId, query }),
  spotifyResolveTrack: (clientId, clientSecret, query) => ipcRenderer.invoke('spotify:resolve-track', { clientId, clientSecret, query }),
  spotifyAuth: {
    status: () => ipcRenderer.invoke('spotify:auth-status'),
    login: (clientId, clientSecret) => ipcRenderer.invoke('spotify:authorize', { clientId, clientSecret }),
    logout: () => ipcRenderer.invoke('spotify:logout'),
    getLibrary: (clientId, clientSecret) => ipcRenderer.invoke('spotify:get-library', { clientId, clientSecret })
  },
  mic: {
    start: () => ipcRenderer.invoke('mic:start'),
    stop: () => ipcRenderer.invoke('mic:stop'),
    onTranscript: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('mic:transcript', listener);
      return () => ipcRenderer.removeListener('mic:transcript', listener);
    },
    onStatus: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('mic:status', listener);
      return () => ipcRenderer.removeListener('mic:status', listener);
    }
  },
  update: {
    getVersion: () => ipcRenderer.invoke('update:get-version'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onState: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('update:state', listener);
      return () => ipcRenderer.removeListener('update:state', listener);
    }
  }
});
