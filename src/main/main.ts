import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { Database } from './db/database';
import { AppService } from './services/app.service';
import { registerHandlers } from './ipc/handlers';

const isDev = process.argv.includes('--dev');
let db: Database | undefined;
let service: AppService | undefined;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (errorCode === -3) return;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><body style="font-family:sans-serif;padding:40px"><h1>Bestand não conseguiu carregar a interface.</h1><p>${errorCode}: ${errorDescription}</p><p>Execute <code>npm run build</code> antes de <code>npm start</code>.</p></body>`)}`);
  });

  if (isDev) {
    void win.loadURL('http://127.0.0.1:5173');
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

async function bootstrap() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
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
    db = new Database();
    await db.init();
    service = new AppService(db);
    registerHandlers(service);
    createWindow();
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error('[Bestand] Falha ao iniciar:', message);
    const win = new BrowserWindow({ width: 900, height: 600 });
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><body style="font-family:sans-serif;padding:40px"><h1>Erro ao iniciar o Bestand</h1><pre style="white-space:pre-wrap">${message.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre></body>`)}`);
  }
}

app.whenReady().then(bootstrap);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && service) createWindow();
});

app.on('window-all-closed', () => {
  db?.close();
  if (process.platform !== 'darwin') app.quit();
});
