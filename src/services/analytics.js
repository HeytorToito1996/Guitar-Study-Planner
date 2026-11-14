'use strict';
function summarizeSessions(sessions) {
  if (!Array.isArray(sessions)) throw new Error('Sessões inválidas');
  let totalSeconds = 0;
  const byBlock = {};
  for (const session of sessions) {
    if (!session || typeof session.blockId !== 'string' ||
        !Number.isInteger(session.actualSeconds) || session.actualSeconds < 0)
      throw new Error('Sessão inválida');
    totalSeconds += session.actualSeconds;
    byBlock[session.blockId] = (byBlock[session.blockId] || 0) + session.actualSeconds;
  }
  return { sessionCount: sessions.length, totalSeconds, totalMinutes: Math.round(totalSeconds / 60),
    byBlock };
}
module.exports = { summarizeSessions };
