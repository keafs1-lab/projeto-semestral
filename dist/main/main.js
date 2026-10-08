"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const database_1 = require("./db/database");
const app_service_1 = require("./services/app.service");
const handlers_1 = require("./ipc/handlers");
const isDev = process.argv.includes('--dev');
let db;
let service;
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1100,
        minHeight: 700,
        show: false,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    win.once('ready-to-show', () => win.show());
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        if (errorCode === -3)
            return;
        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><body style="font-family:sans-serif;padding:40px"><h1>Bestand não conseguiu carregar a interface.</h1><p>${errorCode}: ${errorDescription}</p><p>Execute <code>npm run build</code> antes de <code>npm start</code>.</p></body>`)}`);
    });
    if (isDev) {
        void win.loadURL('http://127.0.0.1:5173');
    }
    else {
        void win.loadFile(node_path_1.default.join(__dirname, '../renderer/index.html'));
    }
    return win;
}
async function bootstrap() {
    const gotLock = electron_1.app.requestSingleInstanceLock();
    if (!gotLock) {
        electron_1.app.quit();
        return;
    }
    electron_1.app.on('second-instance', () => {
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win) {
            if (win.isMinimized())
                win.restore();
            win.focus();
        }
    });
    electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
                ],
            },
        });
    });
    try {
        db = new database_1.Database();
        await db.init();
        service = new app_service_1.AppService(db);
        (0, handlers_1.registerHandlers)(service);
        createWindow();
    }
    catch (error) {
        const message = error instanceof Error ? error.stack || error.message : String(error);
        console.error('[Bestand] Falha ao iniciar:', message);
        const win = new electron_1.BrowserWindow({ width: 900, height: 600 });
        void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><body style="font-family:sans-serif;padding:40px"><h1>Erro ao iniciar o Bestand</h1><pre style="white-space:pre-wrap">${message.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre></body>`)}`);
    }
}
electron_1.app.whenReady().then(bootstrap);
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0 && service)
        createWindow();
});
electron_1.app.on('window-all-closed', () => {
    db?.close();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
