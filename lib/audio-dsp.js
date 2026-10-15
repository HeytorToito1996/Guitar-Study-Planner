/**
 * audio-dsp.js — DSP puro do player de áudio (sem DOM, sem Electron).
 *
 * Fica isolado do renderer porque o WSOLA é a parte mais delicada do player:
 * separado aqui dá para medir tom e duração exatos em teste, sem passar pela
 * interface nem pelo <audio>.
 *
 * Exporta em window.GuitarStudyDsp.
 */
(function (root) {
  'use strict';

  /**
   * Reamostragem linear: lê o sinal `ratio` vezes mais rápido.
   * ratio > 1 sobe o tom e encurta; ratio < 1 desce o tom e alonga.
   * A duração muda — quem preserva a duração é o WSOLA depois desta etapa.
   */
  function resampleLinear(input, ratio) {
    const length = input.length;
    const outLength = Math.max(2, Math.round(length / ratio));
    const out = new Float32Array(outLength);
    const last = length - 1;

    for (let i = 0; i < outLength; i++) {
      const position = i * ratio;
      const i0 = Math.floor(position);
      if (i0 >= last) {
        out[i] = input[last];
        continue;
      }
      const frac = position - i0;
      out[i] = input[i0] * (1 - frac) + input[i0 + 1] * frac;
    }

    return out;
  }

  /**
   * Transpõe preservando a duração: reamostra (muda o tom, encurta) e depois
   * recompõe com WSOLA, devolvendo o comprimento original sem desfazer o tom.
   *
   * No WSOLA cada janela de saída anda `Hs` e lê `Ha = Hs / ratio` amostras do
   * sinal reamostrado. O deslocamento de cada janela é escolhido para casar com
   * a cauda já escrita — é isso que evita o artefato de fase audível na emenda.
   * O deslocamento sai do canal 0 e vale para os dois, preservando a imagem
   * estéreo.
   */
  function pitchShiftBuffer(buffer, ratio, createBuffer) {
    const make = createBuffer || defaultCreateBuffer;
    const frames = buffer.length;
    const sampleRate = buffer.sampleRate;
    const channels = Math.min(2, buffer.numberOfChannels);

    const src = [];
    for (let c = 0; c < channels; c++) {
      src.push(resampleLinear(buffer.getChannelData(c), ratio));
    }

    const WINDOW = 2048;                    // ≈46 ms a 44,1 kHz
    const Hs = WINDOW >> 1;                 // Hann com 50% de sobreposição
    const Ha = Math.max(1, Math.round(Hs / ratio));
    const SEARCH = 128;                     // alcance da busca de similaridade
    const TAIL = WINDOW - Hs;               // trecho que cruza a emenda

    // Busca em dois estágios: varredura grossa no alcance todo e depois refino
    // fino ao redor do melhor candidato. Equivale à busca exaustiva, mas evita
    // a conta completa em cada janela (que é o que seguraria a interface).
    const COARSE_STEP = 4;
    const COARSE_CORR = 32;
    const FINE_SPAN = 4;
    const FINE_CORR = 4;

    const win = new Float32Array(WINDOW);
    for (let i = 0; i < WINDOW; i++) {
      win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WINDOW);
    }

    const out = make({ length: frames, numberOfChannels: channels, sampleRate });
    const dst = [];
    for (let c = 0; c < channels; c++) dst.push(out.getChannelData(c));

    const lastStart = Math.max(0, src[0].length - WINDOW);

    for (let outPos = 0; outPos < frames; outPos += Hs) {
      let readPos = Math.round((outPos / Hs) * Ha);
      if (readPos > lastStart) readPos = lastStart;

      if (outPos > 0) {
        const lo = Math.max(0, readPos - SEARCH);
        const hi = Math.min(lastStart, readPos + SEARCH);

        const score = (d, step) => {
          let num = 0;
          let den = 0;
          for (let i = 0; i < TAIL; i += step) {
            const v = src[0][d + i];
            num += v * dst[0][outPos + i];
            den += v * v;
          }
          return den > 1e-9 ? num / den : -Infinity;
        };

        let coarseBest = readPos;
        let coarseScore = -Infinity;
        for (let d = lo; d <= hi; d += COARSE_STEP) {
          const value = score(d, COARSE_CORR);
          if (value > coarseScore) {
            coarseScore = value;
            coarseBest = d;
          }
        }

        const fineLo = Math.max(lo, coarseBest - FINE_SPAN);
        const fineHi = Math.min(hi, coarseBest + FINE_SPAN);
        let bestDelta = 0;
        let bestScore = -Infinity;
        for (let d = fineLo; d <= fineHi; d++) {
          const value = score(d, FINE_CORR);
          if (value > bestScore) {
            bestScore = value;
            bestDelta = d - readPos;
          }
        }

        readPos += bestDelta;
      }

      const limit = Math.min(WINDOW, frames - outPos);
      for (let c = 0; c < channels; c++) {
        const s = src[c];
        const y = dst[c];
        for (let i = 0; i < limit; i++) y[outPos + i] += s[readPos + i] * win[i];
      }
    }

    return out;
  }

  /** Só usado fora do navegador (teste), onde não existe o construtor nativo. */
  function defaultCreateBuffer(options) {
    return new AudioBuffer(options);
  }

  root.GuitarStudyDsp = { resampleLinear, pitchShiftBuffer };
})(typeof window !== 'undefined' ? window : globalThis);