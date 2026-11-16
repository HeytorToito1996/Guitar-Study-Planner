'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createState, toggle, reset, isAudible, sharedChannels } = require('../lib/track-mixer');

const score = {
  tracks: [
    { index: 0, name: 'Lead', playbackInfo: { primaryChannel: 0, isMute: false, isSolo: false } },
    { index: 1, shortName: 'Rhythm', playbackInfo: { primaryChannel: 1, isMute: true, isSolo: false } },
    { index: 2, name: 'Bass', playbackInfo: { primaryChannel: 0, isMute: false, isSolo: true } }
  ]
};

test('createState respeita mute/solo do arquivo e usa rótulos legíveis', () => {
  const state = createState(score, (track, position) => `${position + 1}:${track.name || track.shortName}`);
  assert.deepEqual(state.map((track) => track.index), [0, 1, 2]);
  assert.deepEqual(state.map((track) => track.label), ['1:Lead', '2:Rhythm', '3:Bass']);
  assert.deepEqual(state.map((track) => track.mute), [false, true, false]);
  assert.deepEqual(state.map((track) => track.solo), [false, false, true]);
  assert.deepEqual(state.map((track) => track.channel), [0, 1, 0]);
});

test('toggle alterna apenas a trilha e a ação pedidas sem mutar a origem', () => {
  const state = createState(score);
  const muted = toggle(state, 0, 'mute');
  assert.equal(muted[0].mute, true);
  assert.equal(state[0].mute, false);
  const soloed = toggle(muted, 0, 'solo');
  assert.equal(soloed[0].solo, true);
  assert.equal(soloed[0].mute, true);
  assert.equal(toggle(state, 99, 'mute')[0].mute, false);
  assert.equal(toggle(state, 0, 'volume')[0].mute, false);
});

test('reset limpa mute e solo de todas as trilhas', () => {
  const state = createState(score);
  const clean = reset(state);
  assert.deepEqual(clean.map((track) => [track.mute, track.solo]), [[false, false], [false, false], [false, false]]);
  assert.equal(state[1].mute, true);
});

test('isAudible considera mute e a existência de qualquer solo', () => {
  const state = createState(score);
  assert.equal(isAudible(state[0], false), true);
  assert.equal(isAudible(state[1], false), false);
  // Com solo ativo, só a trilha em solo e sem mute toca.
  assert.equal(isAudible(state[0], true), false);
  assert.equal(isAudible(state[2], true), true);
  assert.equal(isAudible({ ...state[2], mute: true }, true), false);
});

test('sharedChannels aponta canais MIDI usados por mais de uma trilha', () => {
  assert.deepEqual(sharedChannels(createState(score)), [0]);
  assert.deepEqual(sharedChannels([{ index: 0, channel: null }]), []);
});
