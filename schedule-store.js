'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateSchedule, DAYS } = require('./schedule-validator');
const empty = () => Object.fromEntries(DAYS.map(day => [day, []]));
function writeAtomic(file, data, { backup = true } = {}) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', flag: 'wx' });
    if (backup && fs.existsSync(file)) {
      const old = JSON.parse(fs.readFileSync(file, 'utf8'));
      validateSchedule(old);
      const backupTmp = file + '.bak.' + crypto.randomUUID() + '.tmp';
      try {
        fs.copyFileSync(file, backupTmp);
        fs.renameSync(backupTmp, file + '.bak');
      } finally {
        if (fs.existsSync(backupTmp)) fs.unlinkSync(backupTmp);
      }
    }
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
function saveSchedule(file, data) {
  validateSchedule(data);
  writeAtomic(file, data);
}
function loadSchedule(file) {
  if (!fs.existsSync(file)) {
    const initial = empty();
    writeAtomic(file, initial, { backup: false });
    return initial;
  }
  try {
    return validateSchedule(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    const backup = file + '.bak';
    if (fs.existsSync(backup)) {
      try {
        const restored = validateSchedule(JSON.parse(fs.readFileSync(backup, 'utf8')));
        // Preserve the damaged original for investigation, never overwrite it silently.
        fs.copyFileSync(file, file + '.corrupt-' + crypto.randomUUID(), fs.constants.COPYFILE_EXCL);
        writeAtomic(file, restored, { backup: false });
        return restored;
      } catch (backupError) {
        throw new Error('Cronograma e backup inválidos: ' + backupError.message, { cause: error });
      }
    }
    throw new Error('Cronograma inválido; original preservado: ' + error.message, { cause: error });
  }
}
module.exports = { loadSchedule, saveSchedule, writeAtomic };
