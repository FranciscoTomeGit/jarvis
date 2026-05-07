const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, safe API to the renderer process.
// Only window control actions are exposed — nothing else touches Node.js from the frontend.
contextBridge.exposeInMainWorld('electron', {
    minimize: () => ipcRenderer.send('window-minimize'),
    close:    () => ipcRenderer.send('window-close'),
});
