'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateSchedule, DAYS } = require('./schedule-validator');
const empty = () => Object.fromEntries(DAYS.map(day => [day, []]));
function writeAtomic(file, data, { backup = true } = {}) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', flag: 'wx' });
    if (backup && fs.existsSync(file)) {
      const old = JSON.parse(fs.readFileSync(file, 'utf8'));
      validateSchedule(old);
      fs.copyFileSync(file, file + '.bak');
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
        fs.copyFileSync(file, file + '.corrupt');
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
