'use strict';

(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GuitarStudyTrackSelector = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const PROGRAM_FAMILIES = [
    'Piano', 'Percussão cromática', 'Órgão', 'Guitarra', 'Baixo', 'Cordas',
    'Ensemble', 'Metais', 'Palhetas', 'Sopros', 'Sintetizador', 'Pads',
    'Efeitos', 'Étnico', 'Percussão', 'Efeitos sonoros'
  ];

  function clean(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function instrumentName(track) {
    if (track && track.isPercussion) return 'Percussão';
    const program = Number(track && track.playbackInfo && track.playbackInfo.program);
    if (!Number.isInteger(program) || program < 0 || program > 127) return '';
    return PROGRAM_FAMILIES[Math.floor(program / 8)] || '';
  }

  function trackLabel(track, position) {
    const name = clean(track && track.name) || clean(track && track.shortName);
    const instrument = instrumentName(track);
    const fallback = `Trilha ${position + 1}`;
    if (!name) return instrument ? `${fallback} — ${instrument}` : fallback;
    return instrument && !name.toLocaleLowerCase('pt-BR').includes(instrument.toLocaleLowerCase('pt-BR'))
      ? `${name} — ${instrument}`
      : name;
  }

  function trackOptions(score) {
    const tracks = score && Array.isArray(score.tracks) ? score.tracks : [];
    return tracks.map((track, position) => ({
      index: Number.isInteger(track.index) ? track.index : position,
      label: trackLabel(track, position)
    }));
  }

  return { instrumentName, trackLabel, trackOptions };
});
