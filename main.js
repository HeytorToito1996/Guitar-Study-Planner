/**
 * main.js — Processo principal do Electron
 *
 * Responsabilidades:
 *  - Criação e gerenciamento da janela principal
 *  - Handlers IPC para diálogos nativos (abrir/salvar arquivos)
 *  - Leitura e escrita do schedule.json via módulo fs
 *  - Controle de tela cheia (Modo Foco)
 */

const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── Caminhos de dados ──────────────────────────────────────────────────────
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');

/** Cor de fundo da janela por tema — evita o "flash" branco ao abrir o app */
const THEME_BACKGROUNDS = {
  light: '#f2f5fb',
  dark: '#1a1a2e'
};

/** Estrutura padrão do cronograma semanal */
const DEFAULT_SCHEDULE = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: []
};

// ─── Helpers de persistência ────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSchedule() {
  ensureDataDir();
  if (!fs.existsSync(SCHEDULE_FILE)) {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(DEFAULT_SCHEDULE, null, 2), 'utf-8');
    return { ...DEFAULT_SCHEDULE };
  }
  try {
    const raw = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

function saveSchedule(data) {
  ensureDataDir();
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Janela principal ──────────────────────────────────────────────────────

let mainWindow = null;

/** Tema atual ('light' | 'dark'); espelhado a partir do renderer */
let currentTheme = 'dark';

function applyNativeTheme(theme) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  // Faz menus/diálogos nativos do sistema usarem a mesma paleta do app
  nativeTheme.themeSource = currentTheme;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(THEME_BACKGROUNDS[currentTheme]);
  }
}

function createWindow() {
  // O renderer aplica o tema salvo logo no início; aqui usamos a preferência
  // do sistema como fallback para a cor de fundo da janela.
  applyNativeTheme(nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'Guitar Study Router',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: THEME_BACKGROUNDS[currentTheme],
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // necessário para que preload acesse path/etc.
    }
  });

  mainWindow.loadFile('index.html');

  // Esconder barra de menu padrão
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── IPC Handlers ──────────────────────────────────────────────────────────

// Leitura do cronograma
ipcMain.handle('schedule:load', () => {
  return loadSchedule();
});

// Salvamento do cronograma
ipcMain.handle('schedule:save', (_event, data) => {
  saveSchedule(data);
  return { success: true };
});

// Entrar no Modo Foco (tela cheia)
ipcMain.handle('window:enterFocus', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(true);
    mainWindow.setMenuBarVisibility(false);
  }
});

// Sair do Modo Foco
ipcMain.handle('window:exitFocus', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(false);
  }
});

// Sincronizar o tema nativo com o tema escolhido no app
ipcMain.handle('theme:set', (_event, theme) => {
  applyNativeTheme(theme);
  return currentTheme;
});

// Abrir diálogo para selecionar arquivo GuitarPro
ipcMain.handle('dialog:openGpFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Tablatura GuitarPro',
    filters: [
      { name: 'GuitarPro', extensions: ['gp3', 'gp4', 'gp5', 'gpx', 'gp'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Abrir diálogo para selecionar arquivo de áudio (repertório)
ipcMain.handle('dialog:openAudioFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Áudio',
    filters: [
      { name: 'Áudio', extensions: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'webm', 'aiff'] },
      { name: 'Todos os arquivos', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Importar cronograma JSON
ipcMain.handle('dialog:importJson', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar Cronograma JSON',
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
});

// Exportar cronograma JSON
ipcMain.handle('dialog:exportJson', async (_event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar Cronograma JSON',
    defaultPath: 'cronograma-semanal.json',
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  if (result.canceled || !result.filePath) return false;
  try {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
});

// Ler conteúdo binário de um arquivo de tablatura (para alphaTab)
ipcMain.handle('file:readBinary', async (_event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer; // serializado como Buffer pelo IPC
  } catch {
    return null;
  }
});
