/**
 * scripts/copy-alphatab.js
 * Postinstall script — copia os assets do alphaTab (worker + soundfont)
 * para a pasta /lib/alphatab acessível pelo renderer.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', '@coderline', 'alphatab', 'dist');
const dest = path.join(__dirname, '..', 'lib', 'alphatab');

function copyDir(s, d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  for (const entry of fs.readdirSync(s, { withFileTypes: true })) {
    const sp = path.join(s, entry.name);
    const dp = path.join(d, entry.name);
    if (entry.isDirectory()) copyDir(sp, dp);
    else fs.copyFileSync(sp, dp);
  }
}

if (fs.existsSync(src)) {
  copyDir(src, dest);
  console.log('[postinstall] alphaTab assets copiados para lib/alphatab');
} else {
  console.warn('[postinstall] AVISO: pasta dist do alphaTab não encontrada em', src);
}
