'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || '';

function directive(name) {
  return csp.match(new RegExp(`${name} ([^;]+)`))?.[1] || '';
}

test('CSP permite o worker blob e o soundfont exigidos pelo AlphaTab', () => {
  // O AlphaTab cria o worker do sintetizador a partir de um Blob e carrega o
  // soundfont por XHR. Sem essas permissões o player fica mudo.
  assert.match(directive('worker-src'), /'self'/);
  assert.match(directive('worker-src'), /blob:/);
  assert.match(directive('connect-src'), /'self'/);
  assert.doesNotMatch(directive('connect-src'), /'none'/);
  assert.match(directive('script-src'), /'self'/);
});
