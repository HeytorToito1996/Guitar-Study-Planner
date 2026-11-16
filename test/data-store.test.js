'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  SCHEMA_VERSION, normalizeState, mergeLegacyGoals, mediaAllowlist, createStore
} = require('../lib/data-store');

test('normaliza schema legado, limites e BPM opcional', () => {
  const state = normalizeState({ monday: [{ topic: 'inválido', duration: 999, restTime: -2, metrics: [{ date: '2026-01-02', bpm: 120 }] }] });
  assert.equal(state.schemaVersion, SCHEMA_VERSION);
  assert.equal(state.schedule.monday[0].topic, 'Técnica');
  assert.equal(state.schedule.monday[0].duration, 480);
  assert.equal(state.schedule.monday[0].restTime, 0);
  assert.deepEqual(state.schedule.monday[0].sessions[0], { date: '2026-01-02', durationSeconds: 0, bpm: 120 });
});

test('salvamento é recuperável pelo backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guitar-store-'));
  const file = path.join(dir, 'state.json');
  const store = createStore(file);
  store.save({ schedule: { monday: [{ id: 'a', topic: 'Técnica', duration: 10 }] } });
  store.save({ schedule: { monday: [{ id: 'b', topic: 'Harmonia', duration: 20 }] } });
  fs.writeFileSync(file, '{corrompido');
  const loaded = store.load();
  assert.equal(loaded.recovered, true);
  assert.equal(loaded.state.schedule.monday[0].id, 'a');
  assert.equal(fs.readFileSync(`${file}.corrupt`, 'utf8'), '{corrompido');
});

test('sessão mantém duração efetiva e aceita BPM ausente', () => {
  const state = normalizeState({ schedule: { monday: [{ sessions: [{ durationSeconds: 93, bpm: null }] }] } });
  assert.equal(state.schedule.monday[0].sessions[0].durationSeconds, 93);
  assert.equal(state.schedule.monday[0].sessions[0].bpm, null);
});

test('normalização torna IDs de metas únicos inclusive quando duplicados', () => {
  const state = normalizeState({ goals: [
    { id: 'igual', texto: 'Primeira' },
    { id: 'igual', texto: 'Segunda' },
    { texto: 'Sem ID' },
    { texto: 'Outra sem ID' }
  ] });
  assert.equal(new Set(state.goals.map((goal) => goal.id)).size, 4);
  assert.equal(state.goals[0].id, 'igual');
  assert.equal(state.goals[1].id, 'igual-2');
});

test('migração preserva metas existentes, importa legadas e só ocorre uma vez', () => {
  const current = normalizeState({ goals: [{ id: 'atual', texto: 'Atual' }] });
  const migrated = mergeLegacyGoals(current, [{ id: 'legada', texto: 'Legada' }]);
  assert.deepEqual(migrated.goals.map((goal) => goal.texto), ['Atual', 'Legada']);
  assert.equal(migrated.migrations.legacyGoalsLocalStorage, true);
  const repeated = mergeLegacyGoals(migrated, [{ id: 'outra', texto: 'Não importar' }]);
  assert.deepEqual(repeated.goals.map((goal) => goal.texto), ['Atual', 'Legada']);
});

test('migração ignora metas com conteúdo duplicado mesmo quando os IDs diferem', () => {
  const current = normalizeState({ goals: [{ id: 'atual', texto: 'Escalas', prazo: 'longo', criado: '2026-01-02' }] });
  const migrated = mergeLegacyGoals(current, [
    { id: 'legada', texto: 'Escalas', prazo: 'longo', criado: '2026-01-02' },
    { id: 'nova', texto: 'Arpejos', prazo: 'curto', criado: '2026-01-03' }
  ]);
  assert.deepEqual(migrated.goals.map((goal) => goal.texto), ['Escalas', 'Arpejos']);
});

test('store atualiza cronograma legado no disco e o recarrega no schema atual', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guitar-legacy-'));
  const file = path.join(dir, 'state.json');
  fs.writeFileSync(file, JSON.stringify({ monday: [{ id: 'legado', topic: 'Harmonia', duration: 25 }] }));
  const store = createStore(file);
  const first = store.load().state;
  store.save(first);
  const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
  const reloaded = store.load().state;
  assert.equal(persisted.schemaVersion, SCHEMA_VERSION);
  assert.equal(persisted.schedule.monday[0].id, 'legado');
  assert.equal(reloaded.schedule.monday[0].topic, 'Harmonia');
});

test('allowlist pode ser reconstruída após salvar e recarregar o estado', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guitar-media-'));
  const file = path.join(dir, 'state.json');
  const store = createStore(file);
  store.save({ schedule: { monday: [{ tabFile: '/tmp/reload.gp5', audioFile: '/tmp/reload.mp3' }] } });
  assert.deepEqual([...mediaAllowlist(store.load().state)], [
    [path.resolve('/tmp/reload.gp5'), 'gp'],
    [path.resolve('/tmp/reload.mp3'), 'audio']
  ]);
});

test('allowlist contém somente mídias derivadas do estado normalizado', () => {
  const state = { schedule: { monday: [
    { topic: 'Técnica', tabFile: '/tmp/estudo.gp5', audioFile: '/tmp/apoio.mp3' },
    { topic: 'Técnica', tabFile: 123, audioFile: '' }
  ] } };
  assert.deepEqual([...mediaAllowlist(state)], [
    [path.resolve('/tmp/estudo.gp5'), 'gp'],
    [path.resolve('/tmp/apoio.mp3'), 'audio']
  ]);
});
