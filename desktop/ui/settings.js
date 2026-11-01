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
    if (key === 'ttsRate' || key === 'animationSpeed') return value.toFixed(2) + '×';
    if (key === 'typewriterCps') return value + ' characters per second';
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
    const m = data.modes && data.modes[s.mode];
    if (m) $('modeTagline').textContent = m.tagline + ' Modes never change your saved settings.';
    $('hotkeyNote').textContent = 'Registers one key combination with macOS. Dexter sees no other keys. Status: ' + data.hotkeyStatus + '.';
    $('cacheNote').textContent = 'Saves synthesized audio in Dexter\'s own folder (' + data.ttsCacheStats.files + ' files). Turning it off deletes it.';
    const sess = data.session;
    $('sessionResult').textContent = sess && sess.active ? 'Session running: ' + Math.round(sess.remainingMs / 60000) + ' min left' + (sess.paused ? ' (paused)' : '') + '.' : 'No session running.';
    renderNotes(data.notes || []);
    renderCustom(s.customCheckins || []);
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
      if (key === 'sttEnabled' && value && !confirm('Enable speech input?\n\nA microphone button will appear in the conversation panel. Dexter records only between your clicks, transcribes on this computer, and deletes the audio. macOS will ask for microphone access.')) { el.checked = false; return; }
      if (key === 'keepJournal' && value && !confirm('Keep a local journal?\n\nCheck-in answers and session events will be saved on this computer until you turn this off or delete the journal.')) { el.checked = false; return; }
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

  // ---- Notes
  function renderNotes(list) {
    const ul = $('noteList'); ul.replaceChildren();
    for (const n of list) {
      const li = document.createElement('li'); const span = document.createElement('span'); span.textContent = n.text;
      const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Delete'; del.setAttribute('aria-label', 'Delete note: ' + n.text);
      del.addEventListener('click', async () => { await ui.invoke('notes:remove', n.id); render(await ui.invoke('settings:get')); });
      li.append(span, del); ul.appendChild(li);
    }
    if (!list.length) { const li = document.createElement('li'); li.textContent = 'No notes.'; ul.appendChild(li); }
  }
  $('noteAdd').addEventListener('click', async () => {
    const text = $('noteText').value.trim(); if (!text) return;
    await ui.invoke('notes:add', text); $('noteText').value = ''; render(await ui.invoke('settings:get')); saved('Note saved.');
  });
  $('notesClear').addEventListener('click', async () => { if (confirm('Delete all notes?')) { await ui.invoke('notes:clear'); render(await ui.invoke('settings:get')); } });

  // ---- Check-in editor (adapted from WESTCAT-OVERLAY-RELOADED's question editor)
  let editing = null;
  function renderCustom(list) {
    const ul = $('customList'); ul.replaceChildren();
    list.forEach((q, i) => {
      const li = document.createElement('li'); const span = document.createElement('span');
      span.textContent = q.text + ' — ' + q.choices.map(c => c.label + (c.followUp ? ' (+follow-up)' : '')).join(' / ');
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit'; edit.setAttribute('aria-label', 'Edit question: ' + q.text);
      edit.addEventListener('click', () => loadForm(q, i));
      const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Delete'; del.setAttribute('aria-label', 'Delete question: ' + q.text);
      del.addEventListener('click', () => set('customCheckins', current.settings.customCheckins.filter((_, j) => j !== i)));
      li.append(span, edit, del); ul.appendChild(li);
    });
    if (!list.length) { const li = document.createElement('li'); li.textContent = 'None yet. Add one below, or type /ask Question | Answer | Answer in the conversation.'; ul.appendChild(li); }
  }
  function clearForm() { editing = null; $('customForm').reset(); $('cq-save').textContent = 'Add question'; }
  function loadForm(q, index) {
    clearForm(); editing = index;
    $('cq-text').value = q.text;
    q.choices.forEach((c, i) => { $('cq-a' + i).value = c.label; $('cq-r' + i).value = c.reply; });
    const f = q.choices[0].followUp;
    if (f) { $('cq-ftext').value = f.text; f.choices.forEach((c, i) => { $('cq-fa' + i).value = c.label; $('cq-fr' + i).value = c.reply; }); }
    $('cq-save').textContent = 'Save changes'; $('cq-text').focus();
  }
  const reply = (value, label) => value.trim() || ('Noted: ' + label.toLowerCase() + '.');
  $('customForm').addEventListener('submit', event => {
    event.preventDefault();
    const choices = [0, 1, 2, 3].map(i => ({label: $('cq-a' + i).value.trim(), reply: $('cq-r' + i).value})).filter(c => c.label).map(c => ({label: c.label, reply: reply(c.reply, c.label), state: 'watching'}));
    if (choices.length < 2) { saved('A question needs at least two answers.'); return; }
    const fText = $('cq-ftext').value.trim();
    const fChoices = [0, 1].map(i => ({label: $('cq-fa' + i).value.trim(), reply: $('cq-fr' + i).value})).filter(c => c.label).map(c => ({label: c.label, reply: reply(c.reply, c.label), state: 'watching'}));
    if (fText && fChoices.length === 2) choices[0].followUp = {text: fText, choices: fChoices};
    const list = current.settings.customCheckins.slice();
    const q = {text: $('cq-text').value.trim(), choices};
    if (editing !== null && list[editing]) list[editing] = {...q, id: list[editing].id}; else list.push(q);
    void set('customCheckins', list);
    clearForm();
  });
  $('cq-cancel').addEventListener('click', clearForm);

  // ---- Sessions, voices, speech input
  $('sessionStart').addEventListener('click', async () => { await ui.invoke('session:start', current.settings.sessionMinutes); render(await ui.invoke('settings:get')); });
  async function fillPiperVoices() {
    const voices = await ui.invoke('piper:voices');
    const pick = $('voicePick'); pick.replaceChildren(new Option(voices.length ? 'Choose…' : 'No voices found in that folder', ''));
    for (const v of voices) pick.appendChild(new Option(v.name, v.path));
  }
  $('voicePick').addEventListener('change', () => { if ($('voicePick').value) void set('piperModel', $('voicePick').value); });
  document.querySelector('[data-key="piperVoicesDir"]').addEventListener('change', () => setTimeout(fillPiperVoices, 200));
  $('sttCheck').addEventListener('click', async () => { const r = await ui.invoke('stt:check'); $('sttResult').textContent = r.ok ? 'whisper.cpp program and model found.' : r.problems.join(' '); });
  ui.on('settings:changed', render);
  ui.on('settings:section', id => { const el = document.getElementById(String(id)); if (el) { el.scrollIntoView(); el.querySelector('input,select,button')?.focus(); } });
  ui.invoke('settings:get').then(data => { render(data); fillVoices(); void fillPiperVoices(); });
})();
