'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { emptySchedule, addBlock, updateBlock, removeBlock, moveBlock } = require('../src/core/schedule');
const { createSession, pauseSession, resumeSession, finishSession } = require('../src/core/study-session');
const { summarizeSessions } = require('../src/services/analytics');
const block = id => ({ id, topic: 'Técnica', duration: 15, restTime: 5, metrics: [] });
test('CRUD imutável e ordenação dos blocos', () => {
  const original = emptySchedule();
  const one = addBlock(original, 'monday', block('a'));
  const two = addBlock(one, 'monday', block('b'));
  assert.equal(original.monday.length, 0);
  assert.equal(one.monday.length, 1);
  const updated = updateBlock(two, 'monday', 'a', { duration: 30 });
  assert.equal(two.monday[0].duration, 15);
  assert.equal(updated.monday[0].duration, 30);
  const moved = moveBlock(updated, 'monday', 'b', 0);
  assert.deepEqual(moved.monday.map(b => b.id), ['b', 'a']);
  assert.deepEqual(moved.monday.map(b => b.order), [0, 1]);
  assert.deepEqual(removeBlock(moved, 'monday', 'b').monday.map(b => b.id), ['a']);
});
test('operações inválidas não modificam o cronograma original', () => {
  const original = emptySchedule();
  assert.throws(() => addBlock(original, 'invalid', block('a')), /Dia/);
  assert.throws(() => updateBlock(original, 'monday', 'missing', {}), /não encontrado/);
  assert.deepEqual(original.monday, []);
});
test('sessão desconta períodos pausados do tempo real', () => {
  const initial = createSession({ blockId: 'a', plannedMinutes: 15, startedAt: 1000 });
  const paused = pauseSession(initial, 11000);
  const resumed = resumeSession(paused, 16000);
  const finished = finishSession(resumed, 26000);
  assert.equal(finished.actualSeconds, 20);
  assert.equal(finished.plannedMinutes, 15);
});
test('finalização durante pausa não conta tempo pausado', () => {
  const session = pauseSession(createSession({ blockId: 'a', plannedMinutes: 5, startedAt: 0 }), 5000);
  assert.equal(finishSession(session, 15000).actualSeconds, 5);
});
test('analytics resume sessões por bloco', () => {
  assert.deepEqual(summarizeSessions([{blockId:'a',actualSeconds:90},{blockId:'a',actualSeconds:30}]),
    {sessionCount:2,totalSeconds:120,totalMinutes:2,byBlock:{a:120}});
  assert.throws(() => summarizeSessions([{blockId:'a',actualSeconds:-1}]), /inválida/);
});
