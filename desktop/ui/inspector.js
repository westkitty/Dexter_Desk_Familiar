'use strict';
(() => {
  const ui = window.dexterUI;
  const $ = id => document.getElementById(id);
  const time = t => new Date(t).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  function dl(el, rows) {
    el.replaceChildren();
    for (const [k, v] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = String(v); el.append(dt, dd); }
  }
  function list(el, items) {
    el.replaceChildren();
    for (const text of items) { const li = document.createElement('li'); li.textContent = text; el.appendChild(li); }
  }
  async function refresh() {
    const s = await ui.invoke('inspector:snapshot').catch(() => null);
    if (!s) return;
    dl($('familiar'), [['Visual state', s.familiar.visual], ['Semantic state', s.familiar.semantic], ['Napping', s.familiar.napping ? 'yes' : 'no']]);
    list($('history'), s.familiar.history.slice().reverse().map(h => time(h.at) + '  ' + h.from + ' → ' + h.to + (h.reason ? ' (' + h.reason + ')' : '')));
    dl($('mode'), [['Mode', s.mode.label], ['Meaning', s.mode.tagline]]);
    dl($('attention'), [['Used this hour', s.attention.used + ' of ' + s.attention.cap], ['Minimum gap', s.attention.minGapMinutes + ' min']]);
    list($('decisions'), s.attention.decisions.slice().reverse().map(e => time(e.t) + '  ' + e.type + ':' + e.name + (e.detail.reason ? ' — ' + e.detail.reason : '')));
    const sess = s.session;
    dl($('session'), sess.active ? [['Length', sess.minutes + ' min'], ['Remaining', Math.round(sess.remainingMs / 60000) + ' min'], ['Paused', sess.paused ? 'yes' : 'no']] : [['Session', 'none']]);
    dl($('services'), [['Local AI', s.services.ai], ['Speech output', s.services.tts], ['Speech input', s.services.stt], ['Global hotkey', s.services.hotkey], ['Notifications', s.services.notifications]]);
    dl($('memory'), [['Saved notes', s.memory.notes], ['Notes allowed into AI context', s.memory.notesInContext ? 'yes' : 'no'], ['Firewall crossings this session', s.memory.crossings], ['Conversation messages', s.memory.conversation]]);
    if (s.journal) { $('journalNote').textContent = 'Kept on this computer because you enabled the journal.'; list($('journal'), s.journal.slice().reverse().map(j => j.at.slice(11, 19) + '  ' + j.kind + '  ' + Object.entries(j).filter(([k]) => !['at', 'kind'].includes(k)).map(([k, v]) => k + ': ' + v).join(', '))); }
    else { $('journalNote').textContent = 'Journal is off. Nothing is recorded.'; $('journal').replaceChildren(); }
    $('auditResult').textContent = 'Result: ' + s.audit.result.toUpperCase() + ' (' + s.audit.failed + ' failed, ' + s.audit.warned + ' warnings)';
    list($('audit'), s.audit.checks.map(c => c.status.toUpperCase() + ' — ' + c.title + ': ' + c.detail));
  }
  $('s-start').addEventListener('click', () => ui.invoke('session:start', 50).then(refresh));
  $('s-pause').addEventListener('click', () => ui.invoke('session:pause').then(refresh));
  $('s-resume').addEventListener('click', () => ui.invoke('session:resume').then(refresh));
  $('s-stop').addEventListener('click', () => ui.invoke('session:stop').then(refresh));
  ui.on('inspector:changed', () => void refresh());
  // Polls only while this window is open; the window is destroyed on close.
  setInterval(() => { if (!document.hidden) void refresh(); }, 2000);
  void refresh();
})();
