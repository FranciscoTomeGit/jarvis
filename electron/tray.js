const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

class TrayManager {
    constructor({ onShow, onQuit }) {
        this._tray = null;
        this._onShow = onShow;
        this._onQuit = onQuit;
    }

    create() {
        const iconPath = path.join(__dirname, '../assets/icon.png');
        let icon;

        try {
            icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
        } catch {
            icon = nativeImage.createEmpty();
        }

        this._tray = new Tray(icon);
        this._tray.setToolTip('J.A.R.V.I.S.');

        const menu = Menu.buildFromTemplate([
            { label: 'Open JARVIS',  click: this._onShow },
            { type: 'separator' },
            { label: 'Quit',         click: this._onQuit },
        ]);

        this._tray.setContextMenu(menu);
        this._tray.on('double-click', this._onShow);
    }

    destroy() {
        if (this._tray) {
            this._tray.destroy();
            this._tray = null;
        }
    }
}

module.exports = TrayManager;
