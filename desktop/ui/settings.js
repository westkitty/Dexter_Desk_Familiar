'use strict';
(() => {
  const ui = window.dexterUI;
  const $ = id => document.getElementById(id);
  let current = null;
  const inputs = [...document.querySelectorAll('[data-key]')];

  function toControl(el, value) {
    const type = el.dataset.type;
    if (el.type === 'checkbox') el.checked = value === true;
    else if (type === 'percent') el.value = String(Math.round(Number(value) * 100));
    else el.value = value === null || value === undefined ? '' : String(value);
  }
  function fromControl(el) {
    const type = el.dataset.type;
    if (el.type === 'checkbox') return el.checked;
    if (type === 'number') return Number(el.value);
    if (type === 'percent') return Number(el.value) / 100;
    return el.value.trim();
  }
  function describe(key, value) {
    if (key === 'scale') return value + '%';
    if (key === 'opacity' || key === 'ttsVolume') return Math.round(value * 100) + '%';
    if (key === 'ttsRate') return value.toFixed(2) + '×';
    return String(value);
  }
  function render(data) {
    current = data;
    const s = data.settings;
    for (const el of inputs) if (document.activeElement !== el || el.type !== 'text') toControl(el, s[el.dataset.key]);
    for (const out of document.querySelectorAll('output[data-for]')) out.textContent = describe(out.dataset.for, s[out.dataset.for]);
    for (const block of document.querySelectorAll('[data-when]')) block.hidden = !s[block.dataset.when];
    for (const el of document.querySelectorAll('[data-engine]')) el.hidden = el.dataset.engine !== s.ttsEngine;
    for (const el of document.querySelectorAll('[data-mac-only]')) el.hidden = data.platform !== 'darwin';
    $('launchAtLogin').disabled = !data.canLaunchAtLogin;
    if (data.aiDetail && !$('aiResult').dataset.sticky) $('aiResult').textContent = 'Status: ' + data.aiStatus + ' — ' + data.aiDetail;
    if (data.ttsStatus && data.ttsStatus !== 'off') $('ttsResult').textContent = 'Speech: ' + data.ttsStatus;
  }
  let savedTimer = null;
  function saved(text) {
    $('saved').textContent = text;
    clearTimeout(savedTimer); savedTimer = setTimeout(() => { $('saved').textContent = ''; }, 2500);
  }
  async function set(key, value) {
    const result = await ui.invoke('settings:set', {[key]: value});
    render(result);
    if (result.endpointError && key === 'aiEndpoint') { $('aiResult').textContent = 'Not saved: ' + result.endpointError; $('aiResult').dataset.sticky = '1'; }
    else if (key === 'aiEndpoint') delete $('aiResult').dataset.sticky;
    saved(result.rejected && result.rejected.includes(key) ? 'Not saved — that value is not allowed; the previous setting was kept.' : 'Saved.');
  }
  for (const el of inputs) {
    const event = el.type === 'text' || el.type === 'url' ? 'change' : 'input';
    el.addEventListener(event, () => {
      const key = el.dataset.key, value = fromControl(el);
      if (key === 'aiEnabled' && value && !confirm('Enable Local AI?\n\nMessages you type in the conversation panel will be sent to ' + (current?.settings.aiEndpoint || 'your endpoint') + '. Nothing else is sent, and nothing is downloaded.')) { el.checked = false; return; }
      if (key === 'aiAllowRemote' && value && !confirm('Allow a non-local endpoint?\n\nYour messages would leave this computer over your network.')) { el.checked = false; return; }
      void set(key, value);
    });
  }
  for (const button of document.querySelectorAll('[data-command]')) {
    button.addEventListener('click', async () => {
      const result = await ui.invoke(button.dataset.command);
      if (result && result.settings) render(result);
      saved('Done.');
    });
  }
  $('aiTest').addEventListener('click', async () => {
    $('aiResult').textContent = 'Testing…'; delete $('aiResult').dataset.sticky;
    const r = await ui.invoke('ai:test');
    $('aiResult').textContent = (r.ok ? 'OK — ' : 'Not connected — ') + r.detail;
    const list = $('modelList'); list.replaceChildren();
    for (const name of r.models || []) { const o = document.createElement('option'); o.value = name; list.appendChild(o); }
  });
  $('ttsTest').addEventListener('click', async () => { const r = await ui.invoke('tts:test'); $('ttsResult').textContent = r.detail; });
  $('piperCheck').addEventListener('click', async () => { const r = await ui.invoke('piper:check'); $('ttsResult').textContent = r.ok ? 'Piper program and voice found.' : r.problems.join(' '); });
  $('checkinNow').addEventListener('click', async () => { const r = await ui.invoke('checkin:now'); $('checkinResult').textContent = r.shown ? 'Look at Dexter.' : 'Not shown: ' + r.reason; });
  $('audit').addEventListener('click', async () => {
    const audit = await ui.invoke('diag:audit');
    const body = $('auditTable').querySelector('tbody'); body.replaceChildren();
    for (const c of audit.checks) {
      const tr = document.createElement('tr');
      for (const text of [c.title, c.status.toUpperCase(), c.detail]) { const td = document.createElement('td'); td.textContent = text; tr.appendChild(td); }
      tr.className = 'audit-' + c.status; body.appendChild(tr);
    }
    $('auditTable').hidden = false;
    $('diagResult').textContent = 'Self-audit: ' + audit.result.toUpperCase() + ' (' + audit.failed + ' failed, ' + audit.warned + ' warnings).';
  });
  $('report').addEventListener('click', async () => {
    $('reportView').textContent = JSON.stringify(await ui.invoke('diag:report'), null, 2);
    $('reportView').hidden = false;
  });
  $('export').addEventListener('click', async () => {
    const r = await ui.invoke('diag:export');
    $('diagResult').textContent = r.saved ? 'Saved ' + r.name + '. It contains no conversation text.' : 'Export cancelled.';
  });
  $('resetAll').addEventListener('click', async () => {
    if (!confirm('Reset all Dexter settings to defaults?\n\nLocal AI, speech and check-ins will be turned off. Dexter keeps his position.')) return;
    render(await ui.invoke('settings:reset'));
    saved('All settings reset.');
  });
  function fillVoices() {
    const synth = window.speechSynthesis;
    const select = $('voiceSelect');
    const voices = synth ? synth.getVoices().filter(v => v.localService) : [];
    const keep = current?.settings.ttsVoice || '';
    select.replaceChildren(new Option('Default', ''));
    for (const v of voices) select.appendChild(new Option(v.name + ' (' + v.lang + ')', v.name));
    select.value = voices.some(v => v.name === keep) ? keep : '';
    $('voiceNote').textContent = voices.length ? voices.length + ' on-device voices available.' : 'No on-device system voices found. Speech will fall back to text only.';
  }
  window.speechSynthesis?.addEventListener('voiceschanged', fillVoices);
  ui.on('settings:changed', render);
  ui.on('settings:section', id => { const el = document.getElementById(String(id)); if (el) { el.scrollIntoView(); el.querySelector('input,select,button')?.focus(); } });
  ui.invoke('settings:get').then(data => { render(data); fillVoices(); });
})();
