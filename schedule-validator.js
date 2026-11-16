'use strict';
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const TOPICS = ['Aquecimento','Técnica','Improvisação','Harmonia','Repertório'];
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function validateSchedule(value) {
  if (!isObject(value)) throw new Error('O cronograma deve ser um objeto.');
  for (const day of DAYS) {
    if (!Array.isArray(value[day])) throw new Error('Dia inválido ou ausente: ' + day);
    if (value[day].length > 1000) throw new Error('Muitos blocos no dia: ' + day);
    const ids = new Set();
    for (const block of value[day]) {
      if (!isObject(block) || typeof block.id !== 'string' || !block.id || block.id.length > 200)
        throw new Error('ID de bloco inválido em ' + day);
      if (ids.has(block.id)) throw new Error('ID duplicado em ' + day);
      ids.add(block.id);
      if (!TOPICS.includes(block.topic)) throw new Error('Tópico inválido em ' + day);
      if (!Number.isInteger(block.duration) || block.duration < 1 || block.duration > 1440)
        throw new Error('Duração inválida em ' + day);
      if (!Number.isInteger(block.restTime) || block.restTime < 0 || block.restTime > 1440)
        throw new Error('Descanso inválido em ' + day);
      for (const key of ['subtopic','notes']) {
        if (block[key] !== undefined && (typeof block[key] !== 'string' || block[key].length > 100000))
          throw new Error('Campo inválido: ' + key);
      }
      for (const key of ['tabFile','audioFile']) {
        if (block[key] !== undefined && block[key] !== null && (typeof block[key] !== 'string' || block[key].length > 4096))
          throw new Error('Caminho inválido: ' + key);
      }
      if (block.order !== undefined && (!Number.isInteger(block.order) || block.order < 0))
        throw new Error('Ordem inválida');
      if (block.metrics !== undefined) {
        if (!Array.isArray(block.metrics) || block.metrics.length > 100000) throw new Error('Métricas inválidas');
        for (const metric of block.metrics) {
          if (!isObject(metric) || typeof metric.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(metric.date) ||
              !Number.isInteger(metric.bpm) || metric.bpm < 0 || metric.bpm > 2000)
            throw new Error('Métrica inválida');
        }
      }
    }
  }
  return value;
}
module.exports = { validateSchedule, DAYS };
