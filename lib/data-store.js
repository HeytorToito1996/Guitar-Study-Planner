'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 2;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TOPICS = ['Aquecimento', 'Técnica', 'Improvisação', 'Harmonia', 'Repertório'];
const MAX_BLOCKS_PER_DAY = 200;
const MAX_SESSIONS_PER_BLOCK = 2000;

function emptySchedule() {
  return Object.fromEntries(DAYS.map((day) => [day, []]));
}

function text(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function finiteInt(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function normalizeSession(value) {
  if (!value || typeof value !== 'object') return null;
  const bpmValue = Number(value.bpm);
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : new Date().toISOString().slice(0, 10),
    durationSeconds: finiteInt(value.durationSeconds ?? Number(value.minutos) * 60, 0, 24 * 60 * 60, 0),
    bpm: Number.isFinite(bpmValue) && bpmValue >= 20 && bpmValue <= 400 ? Math.round(bpmValue) : null
  };
}

function normalizeBlock(value, order) {
  if (!value || typeof value !== 'object') return null;
  const topic = TOPICS.includes(value.topic) ? value.topic : 'Técnica';
  const sessions = Array.isArray(value.sessions) ? value.sessions : (Array.isArray(value.metrics) ? value.metrics : []);
  return {
    id: text(value.id, 100) || `block-${Date.now()}-${order}`,
    topic,
    subtopic: text(value.subtopic, 140),
    duration: finiteInt(value.duration, 1, 480, 15),
    restTime: finiteInt(value.restTime, 0, 120, 5),
    notes: text(value.notes, 20000),
    sessions: sessions.slice(-MAX_SESSIONS_PER_BLOCK).map(normalizeSession).filter(Boolean),
    tabFile: text(value.tabFile, 4096) || null,
    audioFile: text(value.audioFile, 4096) || null,
    order
  };
}

function normalizeSchedule(value) {
  const source = value && typeof value === 'object' ? value : {};
  const schedule = emptySchedule();
  for (const day of DAYS) {
    const blocks = Array.isArray(source[day]) ? source[day] : [];
    schedule[day] = blocks.slice(0, MAX_BLOCKS_PER_DAY)
      .map((block, index) => normalizeBlock(block, index))
      .filter(Boolean);
  }
  return schedule;
}

function uniqueId(value, fallback, usedIds) {
  const requested = text(value, 100) || fallback;
  let candidate = requested;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    const suffixText = `-${suffix++}`;
    candidate = `${requested.slice(0, 100 - suffixText.length)}${suffixText}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function normalizeGoal(value, index, usedIds) {
  if (!value || typeof value !== 'object') return null;
  const goalText = text(value.texto, 140);
  if (!goalText) return null;
  return {
    id: uniqueId(value.id, `goal-${Date.now()}-${index}`, usedIds),
    texto: goalText,
    prazo: value.prazo === 'longo' ? 'longo' : 'curto',
    feito: value.feito === true,
    criado: /^\d{4}-\d{2}-\d{2}$/.test(value.criado) ? value.criado : new Date().toISOString().slice(0, 10)
  };
}

function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const legacySchedule = DAYS.some((day) => Array.isArray(source[day])) ? source : null;
  const usedGoalIds = new Set();
  return {
    schemaVersion: SCHEMA_VERSION,
    schedule: normalizeSchedule(source.schedule || legacySchedule),
    goals: (Array.isArray(source.goals) ? source.goals : []).slice(0, 1000)
      .map((goal, index) => normalizeGoal(goal, index, usedGoalIds)).filter(Boolean),
    migrations: {
      legacyGoalsLocalStorage: source.migrations?.legacyGoalsLocalStorage === true
    }
  };
}

function goalFingerprint(goal) {
  return [goal.texto.toLocaleLowerCase('pt-BR'), goal.prazo, goal.criado].join('\u0000');
}

function mergeLegacyGoals(state, legacyGoals) {
  const normalized = normalizeState(state);
  if (normalized.migrations.legacyGoalsLocalStorage) return normalized;
  const incoming = normalizeState({ goals: Array.isArray(legacyGoals) ? legacyGoals : [] }).goals;
  const seenIds = new Set(normalized.goals.map((goal) => goal.id));
  const seenContent = new Set(normalized.goals.map(goalFingerprint));
  const additions = incoming.filter((goal) => {
    const fingerprint = goalFingerprint(goal);
    if (seenIds.has(goal.id) || seenContent.has(fingerprint)) return false;
    seenIds.add(goal.id);
    seenContent.add(fingerprint);
    return true;
  });
  normalized.goals = normalizeState({ goals: [...normalized.goals, ...additions] }).goals;
  normalized.migrations.legacyGoalsLocalStorage = true;
  return normalized;
}

function mediaAllowlist(state) {
  const normalized = normalizeState(state);
  const files = new Map();
  for (const day of DAYS) {
    for (const block of normalized.schedule[day]) {
      if (block.tabFile) files.set(path.resolve(block.tabFile), 'gp');
      if (block.audioFile) files.set(path.resolve(block.audioFile), 'audio');
    }
  }
  return files;
}

function createStore(filePath, io = fs) {
  const backupPath = `${filePath}.bak`;
  const tempPath = `${filePath}.tmp`;

  function ensureDir() {
    io.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function parseFile(candidate) {
    return normalizeState(JSON.parse(io.readFileSync(candidate, 'utf8')));
  }

  function save(input) {
    ensureDir();
    const state = normalizeState(input);
    io.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    const fd = io.openSync(tempPath, 'r');
    try { io.fsyncSync(fd); } finally { io.closeSync(fd); }
    if (io.existsSync(filePath)) io.copyFileSync(filePath, backupPath);
    io.renameSync(tempPath, filePath);
    return state;
  }

  function load() {
    ensureDir();
    if (!io.existsSync(filePath)) return { state: save({}), recovered: false };
    try {
      return { state: parseFile(filePath), recovered: false };
    } catch (primaryError) {
      if (!io.existsSync(backupPath)) throw new Error(`Dados inválidos e nenhum backup disponível: ${primaryError.message}`);
      try {
        const state = parseFile(backupPath);
        io.unlinkSync(filePath);
        save(state);
        return { state, recovered: true };
      } catch (backupError) {
        throw new Error(`Dados e backup inválidos: ${backupError.message}`);
      }
    }
  }

  return { load, save, backupPath, tempPath };
}

module.exports = {
  SCHEMA_VERSION, DAYS, emptySchedule, normalizeSchedule, normalizeState,
  mergeLegacyGoals, mediaAllowlist, createStore
};
