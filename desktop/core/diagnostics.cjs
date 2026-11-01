'use strict';
// Self-audit and exportable diagnostics, adapted from Westcat_Familiar's
// selfAudit.ts idea (live checks against the running app) without its mock data.
// Pure: main.cjs gathers a snapshot, these functions judge and format it.

function check(id, title, pass, detail, severity = 'error') {
  return {id, title, status: pass ? 'pass' : (severity === 'warn' ? 'warn' : 'fail'), detail};
}

function runSelfAudit(s) {
  const checks = [];
  const windows = Array.isArray(s.windows) ? s.windows : [];
  checks.push(check('renderer-isolation', 'Renderers are sandboxed and context-isolated',
    windows.length > 0 && windows.every(w => w.sandbox && w.contextIsolation && !w.nodeIntegration),
    windows.map(w => w.name + ':' + (w.sandbox && w.contextIsolation && !w.nodeIntegration ? 'ok' : 'UNSAFE')).join(', ')));
  checks.push(check('renderer-network', 'Pages cannot open network connections',
    Boolean(s.cspConnectNone), s.cspConnectNone ? "connect-src 'none' in every page" : 'A page lacks connect-src none'));
  checks.push(check('egress-policy', 'No model traffic unless Local AI is enabled',
    (s.egressWhileDisabled || 0) === 0,
    (s.egressCount || 0) + ' model request(s) this session, ' + (s.egressWhileDisabled || 0) + ' while disabled; Local AI now ' + (s.settings?.aiEnabled ? 'enabled' : 'disabled')));
  checks.push(check('recovery-tray', 'Menu-bar recovery is available', Boolean(s.trayAlive), s.trayAlive ? 'Tray icon present' : 'No tray icon'));
  checks.push(check('recovery-opacity', 'Dexter cannot be made invisible',
    (s.settings?.opacity ?? 1) >= 0.4, 'Opacity ' + Math.round((s.settings?.opacity ?? 1) * 100) + '% (minimum 40%)'));
  checks.push(check('window-onscreen', 'Dexter is on a connected display', Boolean(s.petOnScreen),
    s.petOnScreen ? 'Inside a display work area' : 'Outside all displays — use Restore', 'warn'));
  checks.push(check('passthrough-recoverable', 'Click-through can be undone',
    !s.passThrough || Boolean(s.trayAlive), s.passThrough ? 'Click-through ON; tray Restore disables it' : 'Click-through off'));
  checks.push(check('history-privacy', 'Conversation storage matches the privacy setting',
    s.settings?.rememberConversation ? true : !s.historyFileExists,
    s.settings?.rememberConversation ? 'Remembering conversation on this computer' : (s.historyFileExists ? 'History file exists although remembering is off' : 'Conversation kept in memory only')));
  checks.push(check('settings-writable', 'Preferences can be saved', s.settingsWritable !== false,
    s.settingsWritable === false ? 'Last save failed' : 'Last save succeeded or not yet needed'));
  checks.push(check('listener-budget', 'No accumulating listeners', (s.maxIpcListeners || 0) <= 1 && (s.eventListeners || 0) <= 4,
    'max IPC listeners per channel ' + (s.maxIpcListeners || 0) + ', event-bus listeners ' + (s.eventListeners || 0), 'warn'));
  checks.push(check('memory', 'Memory use is modest', !(s.memoryMB > 600),
    s.memoryMB ? Math.round(s.memoryMB) + ' MB working set across processes' : 'Not measured', 'warn'));
  const failed = checks.filter(c => c.status === 'fail').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  return {at: new Date(s.now || Date.now()).toISOString(), result: failed ? 'fail' : warned ? 'warn' : 'pass', failed, warned, checks};
}

function redactEndpoint(endpoint, loopback) {
  if (!endpoint) return '';
  if (loopback) return endpoint;
  try { const u = new URL(endpoint); return u.protocol + '//<non-local host>:' + (u.port || (u.protocol === 'https:' ? '443' : '80')); }
  catch { return '<invalid>'; }
}

// Export never includes conversation text, file paths or exact coordinates.
function buildReport(s, audit) {
  const settings = {...(s.settings || {})};
  for (const key of ['x', 'y', 'piperPath', 'piperModel', 'ttsVoice']) if (key in settings) settings[key] = settings[key] ? '<set>' : '';
  settings.aiEndpoint = redactEndpoint(settings.aiEndpoint, s.endpointLoopback);
  return {
    kind: 'dexter-desktop-diagnostics', schema: 1,
    generatedAt: new Date(s.now || Date.now()).toISOString(),
    app: s.app || {}, platform: s.platform || {},
    runtime: {uptimeSeconds: Math.round(s.uptimeSeconds || 0), memoryMB: s.memoryMB ? Math.round(s.memoryMB) : null,
      cpuPercent: Number.isFinite(s.cpuPercent) ? Math.round(s.cpuPercent * 10) / 10 : null, displays: s.displayCount || 0,
      familiarState: s.familiarState || 'unknown', visible: Boolean(s.visible), passThrough: Boolean(s.passThrough)},
    ai: {status: s.aiStatus || 'off', egressCount: s.egressCount || 0},
    tts: {status: s.ttsStatus || 'off'},
    conversation: {messages: s.conversationSize || 0, persisted: Boolean(settings.rememberConversation)},
    settings,
    audit: audit || runSelfAudit(s),
    events: {counts: s.eventCounts || {}, recent: (s.recentEvents || []).slice(-40)},
    privacy: 'This report excludes conversation text, typed input, file paths, window coordinates and non-local hostnames.'
  };
}

module.exports = {runSelfAudit, buildReport, redactEndpoint};
