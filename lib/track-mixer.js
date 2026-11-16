'use strict';

(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuitarStudyTrackMixer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const ACTIONS = new Set(['mute', 'solo']);

  function trackIndex(track, position) {
    return Number.isInteger(track && track.index) ? track.index : position;
  }

  /**
   * Estado inicial do mixer a partir das trilhas do score.
   * Respeita mute/solo gravados no arquivo, como fazem os players de tablatura.
   */
  function createState(score, labelFor) {
    const tracks = score && Array.isArray(score.tracks) ? score.tracks : [];
    return tracks.map((track, position) => {
      const info = (track && track.playbackInfo) || {};
      return {
        index: trackIndex(track, position),
        label: typeof labelFor === 'function'
          ? labelFor(track, position)
          : ((track && (track.name || track.shortName)) || `Trilha ${position + 1}`),
        mute: Boolean(info.isMute),
        solo: Boolean(info.isSolo),
        channel: Number.isInteger(info.primaryChannel) ? info.primaryChannel : null
      };
    });
  }

  /** Alterna mute ou solo de uma trilha sem mutar o estado recebido. */
  function toggle(state, index, action) {
    const key = ACTIONS.has(action) ? action : null;
    return (Array.isArray(state) ? state : []).map((track) => {
      if (!key || track.index !== index) return { ...track };
      return { ...track, [key]: !track[key] };
    });
  }

  /** Zera mute e solo de todas as trilhas. */
  function reset(state) {
    return (Array.isArray(state) ? state : []).map((track) => ({ ...track, mute: false, solo: false }));
  }

  /**
   * Uma trilha é audível quando não está muda e, se houver qualquer solo,
   * quando ela própria está em solo. O metrônomo é isento pelo AlphaTab.
   */
  function isAudible(track, anySolo) {
    if (!track) return false;
    return !track.mute && (!anySolo || Boolean(track.solo));
  }

  /** Canais MIDI usados por mais de uma trilha (não dá para separá-los). */
  function sharedChannels(state) {
    const counts = new Map();
    for (const track of Array.isArray(state) ? state : []) {
      if (track.channel === null || track.channel === undefined) continue;
      counts.set(track.channel, (counts.get(track.channel) || 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([channel]) => channel);
  }

  return { createState, toggle, reset, isAudible, sharedChannels };
});
