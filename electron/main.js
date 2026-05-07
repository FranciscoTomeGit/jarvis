const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const PythonServer = require('./server');
const TrayManager = require('./tray');

const SERVER_URL = 'http://127.0.0.1:8000';

class JarvisApp {
    constructor() {
        this._window = null;
        this._server = new PythonServer();
        this._tray = new TrayManager({
            onShow: () => this._showWindow(),
            onQuit: () => this._quit(),
        });
    }

    async init() {
        // Single-instance lock — prevent opening JARVIS twice
        if (!app.requestSingleInstanceLock()) {
            app.quit();
            return;
        }
        app.on('second-instance', () => this._showWindow());

        await app.whenReady();

        this._server.start();

        try {
            await this._server.waitUntilReady();
        } catch (err) {
            dialog.showErrorBox(
                'JARVIS — Startup Failed',
                'The Python backend did not start.\n\nMake sure Python is installed and your .env file is configured.'
            );
            app.quit();
            return;
        }

        this._createWindow();
        this._tray.create();
        this._registerShortcuts();
        this._registerIpc();

        // Keep running in tray when all windows are closed
        app.on('window-all-closed', e => e.preventDefault());
        app.on('before-quit', () => this._cleanup());
    }

    _createWindow() {
        this._window = new BrowserWindow({
            width: 1280,
            height: 820,
            minWidth: 900,
            minHeight: 600,
            frame: false,
            backgroundColor: '#020c14',
            icon: path.join(__dirname, '../assets/icon.png'),
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            },
            show: false,
        });

        this._window.loadURL(SERVER_URL);

        // Show only when fully rendered to avoid a white flash
        this._window.once('ready-to-show', () => this._window.show());

        // Hide to tray instead of closing
        this._window.on('close', e => {
            e.preventDefault();
            this._window.hide();
        });
    }

    _showWindow() {
        if (!this._window) return;
        this._window.show();
        this._window.focus();
    }

    _toggleWindow() {
        if (this._window?.isVisible()) {
            this._window.hide();
        } else {
            this._showWindow();
        }
    }

    _registerShortcuts() {
        // Global hotkey to toggle JARVIS from anywhere on the desktop
        globalShortcut.register('CommandOrControl+Shift+J', () => this._toggleWindow());
    }

    _registerIpc() {
        // Window controls sent from the renderer via preload.js
        ipcMain.on('window-minimize', () => this._window?.minimize());
        ipcMain.on('window-close',    () => this._window?.hide());
    }

    _cleanup() {
        globalShortcut.unregisterAll();
        this._tray.destroy();
        this._server.stop();
    }

    _quit() {
        app.exit(0);
    }
}

new JarvisApp().init().catch(err => {
    console.error('Fatal error during startup:', err);
    app.quit();
});
