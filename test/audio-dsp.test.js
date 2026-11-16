'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/audio-dsp.js'), 'utf8'), context);
const dsp = context.globalThis.GuitarStudyDsp;

test('reamostragem altera comprimento conforme a razão', () => {
  const output = dsp.resampleLinear(new Float32Array(100), 2);
  assert.equal(output.length, 50);
});

test('pitch shift preserva o número de quadros', () => {
  const data = Float32Array.from({ length: 4096 }, (_, i) => Math.sin(i / 10));
  const buffer = { length: data.length, sampleRate: 44100, numberOfChannels: 1, getChannelData: () => data };
  const output = dsp.pitchShiftBuffer(buffer, 1.2, ({ length, sampleRate, numberOfChannels }) => {
    const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    return { length, sampleRate, numberOfChannels, getChannelData: (index) => channels[index] };
  });
  assert.equal(output.length, buffer.length);
});
