/**
 * preload.js — Ponte segura entre renderer e main process
 *
 * Usa contextBridge para expor apenas os canais IPC necessários,
 * sem habilitar nodeIntegration no renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── Cronograma ────────────────────────────────────────────────
  /** Carrega o cronograma semanal do arquivo JSON local */
  loadSchedule: () => ipcRenderer.invoke('schedule:load'),

  /** Salva o cronograma semanal completo */
  saveSchedule: (data) => ipcRenderer.invoke('schedule:save', data),

  // ── Janela / Modo Foco ────────────────────────────────────────
  /** Entra em modo tela-cheia (Modo Foco) */
  enterFocus: () => ipcRenderer.invoke('window:enterFocus'),

  /** Sai do modo tela-cheia */
  exitFocus: () => ipcRenderer.invoke('window:exitFocus'),

  // ── Tema (Claro / Escuro) ─────────────────────────────────────
  /** Informa o processo principal qual tema está ativo ('light' | 'dark') */
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),

  // ── Diálogos de Arquivo ───────────────────────────────────────
  /** Abre o seletor de arquivo GuitarPro (.gp3/.gp4/.gp5/.gpx) */
  openGpFile: () => ipcRenderer.invoke('dialog:openGpFile'),

  /** Abre o seletor de arquivo de áudio (mp3/wav/ogg/m4a/flac...) */
  openAudioFile: () => ipcRenderer.invoke('dialog:openAudioFile'),

  /** Importa um cronograma JSON externo */
  importJson: () => ipcRenderer.invoke('dialog:importJson'),

  /** Exporta o cronograma para um arquivo JSON */
  exportJson: (data) => ipcRenderer.invoke('dialog:exportJson', data),

  // ── Leitura Binária ───────────────────────────────────────────
  /** Lê o conteúdo binário de um arquivo (para carregar tablaturas) */
  readBinary: (filePath) => ipcRenderer.invoke('file:readBinary', filePath)
});
