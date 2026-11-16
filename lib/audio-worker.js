'use strict';

importScripts('audio-dsp.js');

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type !== 'pitchShift') return;

  const id = Number(message.id);
  try {
    const channels = message.channels.map((channel) => new Float32Array(channel));
    const source = {
      length: message.length,
      sampleRate: message.sampleRate,
      numberOfChannels: channels.length,
      getChannelData: (index) => channels[index]
    };
    const createBuffer = ({ length, numberOfChannels, sampleRate }) => {
      const output = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
      return { length, sampleRate, numberOfChannels, getChannelData: (index) => output[index] };
    };
    self.postMessage({ type: 'progress', id, progress: 10 });
    const shifted = self.GuitarStudyDsp.pitchShiftBuffer(source, message.ratio, createBuffer);
    self.postMessage({ type: 'progress', id, progress: 95 });
    const result = Array.from({ length: shifted.numberOfChannels }, (_, index) => shifted.getChannelData(index).buffer);
    self.postMessage({ type: 'result', id, sampleRate: shifted.sampleRate, length: shifted.length, channels: result }, result);
  } catch (error) {
    self.postMessage({ type: 'error', id, message: error && error.message ? error.message : 'Falha no processamento' });
  }
};
