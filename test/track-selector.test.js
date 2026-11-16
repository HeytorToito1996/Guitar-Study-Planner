'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { instrumentName, trackLabel, trackOptions } = require('../lib/track-selector');

test('trackLabel usa nome, instrumento e fallback legível', () => {
  assert.equal(trackLabel({ name: 'Solo', playbackInfo: { program: 29 } }, 0), 'Solo — Guitarra');
  assert.equal(trackLabel({ shortName: 'Baixo', playbackInfo: { program: 33 } }, 1), 'Baixo');
  assert.equal(trackLabel({}, 2), 'Trilha 3');
  assert.equal(instrumentName({ isPercussion: true }), 'Percussão');
});

test('trackOptions preserva índices AlphaTab e usa posição como fallback', () => {
  assert.deepEqual(trackOptions({ tracks: [
    { index: 7, name: 'Lead', playbackInfo: { program: 25 } },
    { name: '', playbackInfo: { program: 32 } }
  ] }), [
    { index: 7, label: 'Lead — Guitarra' },
    { index: 1, label: 'Trilha 2 — Baixo' }
  ]);
  assert.deepEqual(trackOptions(null), []);
});
