'use strict';
function createSession({ blockId, startedAt = Date.now(), plannedMinutes }) {
  if (typeof blockId !== 'string' || !blockId.trim()) throw new Error('Bloco obrigatório');
  if (!Number.isInteger(plannedMinutes) || plannedMinutes < 1)
    throw new Error('Duração planejada inválida');
  if (!Number.isFinite(startedAt)) throw new Error('Início inválido');
  return { blockId, startedAt, plannedMinutes, pausedAt: null, pausedMs: 0 };
}
function pauseSession(session, at = Date.now()) {
  if (session.pausedAt !== null) return { ...session };
  if (at < session.startedAt) throw new Error('Horário inválido');
  return { ...session, pausedAt: at };
}
function resumeSession(session, at = Date.now()) {
  if (session.pausedAt === null) return { ...session };
  if (at < session.pausedAt) throw new Error('Horário inválido');
  return { ...session, pausedMs: session.pausedMs + at - session.pausedAt, pausedAt: null };
}
function finishSession(session, endedAt = Date.now()) {
  if (endedAt < session.startedAt || (session.pausedAt !== null && endedAt < session.pausedAt))
    throw new Error('Horário inválido');
  const pausedMs = session.pausedMs + (session.pausedAt === null ? 0 : endedAt - session.pausedAt);
  const activeMs = Math.max(0, endedAt - session.startedAt - pausedMs);
  return { blockId: session.blockId, startedAt: session.startedAt, endedAt,
    plannedMinutes: session.plannedMinutes, actualSeconds: Math.floor(activeMs / 1000) };
}
module.exports = { createSession, pauseSession, resumeSession, finishSession };
