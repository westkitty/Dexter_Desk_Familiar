'use strict';
// Context packet (adapted from Westcat_Familiar's packetForge.ts): a small,
// high-signal handoff of the current situation that the USER exports and may
// paste elsewhere. Real data only; notes included only through the firewall.
function buildPacket({now = Date.now(), mode, semanticState, visualState, attention, session, messages = [], includeMessages = 6, notesBlock = null, version}) {
  const recent = messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-Math.max(0, includeMessages))
    .map(m => ({role: m.role, content: String(m.content).slice(0, 1200)}));
  return {
    kind: 'dexter-context-packet', schema: 1, generatedAt: new Date(now).toISOString(), app: version || '',
    familiar: {mode, semanticState, visualState},
    attention: attention || null,
    session: session && session.active ? {minutes: session.minutes, paused: session.paused, remainingMinutes: Math.round(session.remainingMs / 60000)} : null,
    recentConversation: recent,
    notes: notesBlock ? notesBlock.text : null,
    provenance: {conversation: 'verified (this app)', notes: notesBlock ? 'user-authored, crossed firewall' : 'not included', attention: 'inferred (arbiter decision)'}
  };
}
function packetMarkdown(p) {
  const lines = ['# Dexter context packet', '', 'Generated ' + p.generatedAt + ' · mode ' + p.familiar.mode + ' · state ' + p.familiar.semanticState, ''];
  if (p.session) lines.push('Session: ' + p.session.minutes + ' min, ' + p.session.remainingMinutes + ' min left' + (p.session.paused ? ' (paused)' : ''), '');
  if (p.notes) lines.push('## Notes', p.notes, '');
  if (p.recentConversation.length) { lines.push('## Recent conversation'); for (const m of p.recentConversation) lines.push('**' + (m.role === 'user' ? 'You' : 'Dexter') + ':** ' + m.content); }
  return lines.join('\n') + '\n';
}
module.exports = {buildPacket, packetMarkdown};
