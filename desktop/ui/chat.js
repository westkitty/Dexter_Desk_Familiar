'use strict';
(() => {
  const ui = window.dexterUI;
  const $ = id => document.getElementById(id);
  const log = $('log'), input = $('input'), send = $('send'), stop = $('stop'), notice = $('notice'), pill = $('aiStatus');
  const nodes = new Map();
  let streaming = null;
  const LABEL = {user: 'You', assistant: 'Dexter', dexter: 'Dexter'};
  const STATUS = {off: 'Local replies', idle: 'AI enabled', connecting: 'Connecting…', ready: 'AI ready', streaming: 'Thinking…', offline: 'AI offline', error: 'AI error'};

  function render(m) {
    let li = nodes.get(m.id);
    if (!li) {
      li = document.createElement('li');
      li.innerHTML = '<span class="who"></span><p class="body"></p><span class="meta"></span>';
      nodes.set(m.id, li); log.appendChild(li);
    }
    li.className = 'msg msg-' + m.role + ' is-' + m.status;
    li.querySelector('.who').textContent = LABEL[m.role] || 'Dexter';
    li.querySelector('.body').textContent = m.content || (m.status === 'streaming' ? '…' : '');
    const meta = {cancelled: 'Stopped', error: 'Failed', truncated: 'Truncated', local: m.role === 'assistant' ? 'No model · local reply' : ''}[m.status] || '';
    li.querySelector('.meta').textContent = meta;
    li.setAttribute('aria-busy', m.status === 'streaming' ? 'true' : 'false');
    log.scrollTop = log.scrollHeight;
  }
  function setBusy(id) {
    streaming = id;
    stop.hidden = !id; send.disabled = Boolean(id);
  }
  function showNotice(text) { notice.textContent = text || ''; notice.hidden = !text; }
  function setStatus(s) {
    pill.textContent = STATUS[s.status] || s.status;
    pill.dataset.status = s.status;
    pill.title = s.detail || '';
    if (s.status === 'offline' || s.status === 'error') showNotice(s.detail || 'The model is unavailable. Local replies still work.');
    else if (s.status !== 'streaming') showNotice('');
  }
  function reset(snapshot) {
    log.replaceChildren(); nodes.clear(); setBusy(null);
    for (const m of snapshot.messages) render(m);
    setStatus(snapshot);
    $('memory').textContent = snapshot.remembering ? 'Remembered on this computer.' : 'Not remembered after quitting.';
    if (!snapshot.messages.length) {
      render({id: 'intro', role: 'dexter', status: 'complete', content: snapshot.enabled
        ? 'Local AI is on. I will answer. Briefly.'
        : 'No model is connected. I will reply anyway, unhelpfully. Commands like /treat and /status work regardless.'});
    }
  }
  ui.on('chat:event', event => {
    if (event.type === 'message') { nodes.get('intro')?.remove(); nodes.delete('intro'); render(event.message); if (event.message.status === 'streaming') setBusy(event.message.id); }
    else if (event.type === 'token') {
      const li = nodes.get(event.id);
      if (li) { const body = li.querySelector('.body'); body.textContent = (body.textContent === '…' ? '' : body.textContent) + event.text; log.scrollTop = log.scrollHeight; }
    } else if (event.type === 'done') {
      render({id: event.id, role: 'assistant', status: event.status, content: event.text});
      setBusy(null);
      if (event.detail && event.status !== 'complete') showNotice(event.detail);
    } else if (event.type === 'reset') reset(event.snapshot);
  });
  ui.on('chat:status', setStatus);
  ui.on('settings:changed', s => { $('memory').textContent = s.settings.rememberConversation ? 'Remembered on this computer.' : 'Not remembered after quitting.'; });

  async function submit() {
    const text = input.value.trim();
    if (!text || streaming) return;
    input.value = '';
    showNotice('');
    const result = await ui.invoke('chat:send', text).catch(error => ({ok: false, detail: error.message}));
    if (result && result.ok === false && result.detail) { showNotice(result.detail); input.value = text; }
    input.focus();
  }
  $('composer').addEventListener('submit', event => { event.preventDefault(); void submit(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void submit(); }
  });
  stop.addEventListener('click', () => ui.invoke('chat:cancel'));
  $('clear').addEventListener('click', () => ui.invoke('chat:clear'));
  $('aiSettings').addEventListener('click', () => ui.invoke('chat:open-settings'));
  $('closeChat').addEventListener('click', () => ui.invoke('window:hide-self'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); if (streaming) ui.invoke('chat:cancel'); else ui.invoke('window:hide-self'); }
  });
  window.addEventListener('focus', () => input.focus());
  ui.invoke('chat:history').then(reset).then(() => input.focus());
})();
