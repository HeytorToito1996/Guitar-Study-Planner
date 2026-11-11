'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateSchedule, DAYS } = require('../schedule-validator');
const { saveSchedule, loadSchedule } = require('../schedule-store');
const empty = () => Object.fromEntries(DAYS.map(day => [day, []]));
const block = () => ({id:'test-1',topic:'Técnica',duration:15,restTime:5,metrics:[{date:'2026-11-11',bpm:120}]});
test('aceita cronograma válido', () => { const s=empty();s.monday.push(block());assert.equal(validateSchedule(s),s); });
test('rejeita dias ausentes', () => assert.throws(() => validateSchedule({monday:[]}), /ausente/));
test('rejeita durações e métricas inválidas', () => {
  const s=empty();s.monday.push(block());s.monday[0].duration=-1;
  assert.throws(() => validateSchedule(s), /Duração/);
  s.monday[0].duration=15;s.monday[0].metrics[0].bpm='fast';
  assert.throws(() => validateSchedule(s), /Métrica/);
});
test('salva, mantém backup e recupera arquivo danificado', t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'guitar-study-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'schedule.json');
  const a=empty();a.monday.push(block());
  saveSchedule(file,a);
  const b=empty();b.tuesday.push(block());
  saveSchedule(file,b);
  assert.deepEqual(JSON.parse(fs.readFileSync(file+'.bak','utf8')),a);
  fs.writeFileSync(file,'{broken');
  assert.deepEqual(loadSchedule(file),a);
  assert.equal(fs.readFileSync(file+'.corrupt','utf8'),'{broken');
});
test('não substitui arquivo corrompido sem backup', t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'guitar-study-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'schedule.json');
  fs.writeFileSync(file,'{broken');
  assert.throws(()=>loadSchedule(file),/preservado/);
  assert.equal(fs.readFileSync(file,'utf8'),'{broken');
});
test('rejeita salvamento inválido preservando dados', t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'guitar-study-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'schedule.json');
  saveSchedule(file,empty());
  assert.throws(()=>saveSchedule(file,{monday:[]}));
  assert.deepEqual(loadSchedule(file),empty());
});
