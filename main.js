'use strict';

const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');
const {
  createStore, normalizeSchedule, normalizeState, mergeLegacyGoals, mediaAllowlist
} = require('./lib/data-store');

const DATA_FILE = path.join(app.getPath('userData'), 'data', 'state.json');
const LEGACY_FILE = path.join(app.getPath('userData'), 'data', 'schedule.json');
const store = createStore(DATA_FILE);
const THEME_BACKGROUNDS = { light: '#f2f5fb', dark: '#1a1a2e' };
const GP_EXTENSIONS = new Set(['.gp3', '.gp4', '.gp5', '.gpx', '.gp']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.flac', '.opus', '.webm', '.aiff']);
const MAX_BINARY_SIZE = 250 * 1024 * 1024;

let mainWindow = null;
let currentTheme = 'dark';
const approvedFiles = new Map();

function applyNativeTheme(theme) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  nativeTheme.themeSource = currentTheme;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setBackgroundColor(THEME_BACKGROUNDS[currentTheme]);
}

function createWindow() {
  applyNativeTheme(nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 640,
    title: 'Guitar Routine', icon: path.join(__dirname, 'icon.png'),
    backgroundColor: THEME_BACKGROUNDS[currentTheme],
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function assertTrusted(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error('Origem IPC não autorizada.');
  }
  let senderPath;
  try {
    senderPath = fileURLToPath(event.senderFrame.url);
  } catch {
    throw new Error('Documento IPC não autorizado.');
  }
  if (path.resolve(senderPath) !== path.resolve(path.join(__dirname, 'index.html'))) {
    throw new Error('Documento IPC não autorizado.');
  }
}

function trustedHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrusted(event);
    return handler(event, ...args);
  });
}

function approveFile(filePath, kind) {
  const resolved = path.resolve(filePath);
  approvedFiles.set(resolved, kind);
  return resolved;
}

function refreshApprovedFiles(state) {
  approvedFiles.clear();
  for (const [filePath, kind] of mediaAllowlist(state)) approvedFiles.set(filePath, kind);
}

function saveState(data) {
  const state = store.save(normalizeState(data));
  refreshApprovedFiles(state);
  return state;
}

async function pickFile(title, extensions, kind) {
  const result = await dialog.showOpenDialog(mainWindow, { title, filters: [{ name: title, extensions }], properties: ['openFile'] });
  if (result.canceled || result.filePaths.length !== 1) return null;
  return approveFile(result.filePaths[0], kind);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

function loadState() {
  if (!fs.existsSync(DATA_FILE) && fs.existsSync(LEGACY_FILE)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
      return { state: saveState({ schedule: legacy }), recovered: false, migrated: true };
    } catch (error) {
      // O schedule.json antigo fica intacto para recuperação manual; o app
      // segue com um estado novo em vez de falhar na inicialização.
      console.error('Não foi possível migrar o schedule.json legado:', error);
    }
  }
  const loaded = store.load();
  refreshApprovedFiles(loaded.state);
  return loaded;
}

trustedHandler('state:load', loadState);
trustedHandler('state:save', (_event, data) => {
  const current = store.load().state;
  const input = data && typeof data === 'object' ? data : {};
  return { success: true, state: saveState({ ...input, migrations: current.migrations }) };
});
trustedHandler('state:migrateLegacyGoals', (_event, legacyGoals) => {
  const current = store.load().state;
  if (current.migrations.legacyGoalsLocalStorage) {
    refreshApprovedFiles(current);
    return { success: true, migrated: false, state: current };
  }
  const state = saveState(mergeLegacyGoals(current, legacyGoals));
  return { success: true, migrated: true, state };
});
trustedHandler('schedule:load', () => loadState().state.schedule);
trustedHandler('schedule:save', (_event, schedule) => {
  const current = store.load().state;
  current.schedule = normalizeSchedule(schedule);
  saveState(current);
  return { success: true };
});
trustedHandler('window:enterFocus', () => { if (mainWindow) mainWindow.setFullScreen(true); });
trustedHandler('window:exitFocus', () => { if (mainWindow) mainWindow.setFullScreen(false); });
trustedHandler('theme:set', (_event, theme) => { applyNativeTheme(theme); return currentTheme; });
trustedHandler('dialog:openGpFile', () => pickFile('Selecionar Tablatura GuitarPro', ['gp3', 'gp4', 'gp5', 'gpx', 'gp'], 'gp'));
trustedHandler('dialog:openAudioFile', () => pickFile('Selecionar Áudio', [...AUDIO_EXTENSIONS].map((x) => x.slice(1)), 'audio'));
trustedHandler('dialog:importJson', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Importar Cronograma JSON', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
  if (result.canceled || result.filePaths.length !== 1) return null;
  const stat = fs.statSync(result.filePaths[0]);
  if (stat.size > 5 * 1024 * 1024) throw new Error('Arquivo de importação excede 5 MB.');
  return normalizeSchedule(JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')));
});
trustedHandler('dialog:exportJson', async (_event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Exportar Cronograma JSON', defaultPath: 'cronograma-semanal.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, `${JSON.stringify(normalizeSchedule(data), null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return true;
});
trustedHandler('file:readBinary', (_event, filePath) => {
  if (typeof filePath !== 'string') throw new Error('Caminho inválido.');
  const resolved = path.resolve(filePath);
  const kind = approvedFiles.get(resolved);
  const extension = path.extname(resolved).toLowerCase();
  if (!kind || (kind === 'gp' && !GP_EXTENSIONS.has(extension)) || (kind === 'audio' && !AUDIO_EXTENSIONS.has(extension))) {
    throw new Error('Arquivo não autorizado. Selecione-o novamente.');
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size > MAX_BINARY_SIZE) throw new Error('Arquivo inválido ou maior que 250 MB.');
  return fs.readFileSync(resolved);
});
