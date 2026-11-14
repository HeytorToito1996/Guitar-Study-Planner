'use strict';
const { validateSchedule, DAYS } = require('../../schedule-validator');
const TOPICS = Object.freeze(['Aquecimento', 'Técnica', 'Improvisação', 'Harmonia', 'Repertório']);
const emptySchedule = () => Object.fromEntries(DAYS.map(day => [day, []]));
function assertDay(day) {
  if (!DAYS.includes(day)) throw new Error('Dia inválido: ' + day);
}
function cloneSchedule(schedule) {
  return JSON.parse(JSON.stringify(validateSchedule(schedule)));
}
function addBlock(schedule, day, block) {
  assertDay(day);
  const next = cloneSchedule(schedule);
  next[day].push({ ...block, order: next[day].length });
  validateSchedule(next);
  return next;
}
function updateBlock(schedule, day, id, changes) {
  assertDay(day);
  const next = cloneSchedule(schedule);
  const index = next[day].findIndex(block => block.id === id);
  if (index < 0) throw new Error('Bloco não encontrado');
  next[day][index] = { ...next[day][index], ...changes, id };
  validateSchedule(next);
  return next;
}
function removeBlock(schedule, day, id) {
  assertDay(day);
  const next = cloneSchedule(schedule);
  next[day] = next[day].filter(block => block.id !== id)
    .map((block, order) => ({ ...block, order }));
  validateSchedule(next);
  return next;
}
function moveBlock(schedule, day, id, targetIndex) {
  assertDay(day);
  const next = cloneSchedule(schedule);
  const blocks = next[day];
  const sourceIndex = blocks.findIndex(block => block.id === id);
  if (sourceIndex < 0) throw new Error('Bloco não encontrado');
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= blocks.length)
    throw new Error('Posição inválida');
  const [block] = blocks.splice(sourceIndex, 1);
  blocks.splice(targetIndex, 0, block);
  next[day] = blocks.map((item, order) => ({ ...item, order }));
  return next;
}
module.exports = { TOPICS, DAYS, emptySchedule, addBlock, updateBlock, removeBlock, moveBlock };
