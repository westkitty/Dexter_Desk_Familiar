'use strict';
(() => {
  const ui = window.dexterUI;
  const $ = id => document.getElementById(id);
  const log = $('log'), input = $('input'), send = $('send'), stop = $('stop'), notice = $('notice'), pill = $('aiStatus'), modelPick = $('chatModel');
  const nodes = new Map();
  let streaming = null;
  const LABEL = {user: 'You', assistant: 'Dexter', dexter: 'Dexter'};
  const STATUS = {off: 'Local replies', idle: 'AI enabled', connecting: 'Connecting…', ready: 'AI ready', streaming: 'Thinking…', offline: 'AI offline', error: 'AI error'};

  function render(m) {
    let li = nodes.get(m.id);
    if (!li) {
      li = document.createElement('li');
      li.innerHTML = '<span class="who"></span><p class="body"></p><div class="citations"></div><span class="meta"></span>';
      nodes.set(m.id, li); log.appendChild(li);
    }
    li.className = 'msg msg-' + m.role + ' is-' + m.status;
    li.querySelector('.who').textContent = LABEL[m.role] || 'Dexter';
    li.querySelector('.body').textContent = m.content || (m.status === 'streaming' ? '…' : '');
    const citeDiv = li.querySelector('.citations');
    if (citeDiv) {
      citeDiv.replaceChildren();
      if (Array.isArray(m.citations) && m.citations.length) {
        for (const c of m.citations) {
          const tag = document.createElement('span');
          tag.className = 'citation-tag';
          tag.textContent = c;
          citeDiv.appendChild(tag);
        }
      }
    }
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
  function updateModelPicker(data) {
    if (!modelPick) return;
    const models = Array.isArray(data?.availableModels) ? data.availableModels : Array.isArray(data?.models) ? data.models : [];
    if (!data?.enabled && data?.enabled !== undefined) {
      modelPick.hidden = true;
      return;
    }
    if (models.length === 0) {
      modelPick.hidden = true;
      return;
    }
    modelPick.hidden = false;
    const current = data.currentModel || data.model || modelPick.value;
    modelPick.replaceChildren();
    for (const name of models) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === current) opt.selected = true;
      modelPick.appendChild(opt);
    }
    if (current && models.includes(current)) modelPick.value = current;
  }
  function setCompact(on) { document.body.classList.toggle('compact', on); $('compact').setAttribute('aria-pressed', String(on)); }
  function reset(snapshot) {
    log.replaceChildren(); nodes.clear(); setBusy(null);
    setCompact(snapshot.compact === true);
    $('mic').hidden = !snapshot.stt;
    $('retry').hidden = !snapshot.canRetry;
    for (const m of snapshot.messages) render(m);
    setStatus(snapshot);
    updateModelPicker(snapshot);
    $('memory').textContent = snapshot.remembering ? 'Remembered on this computer.' : 'Not remembered after quitting.';
    if (!snapshot.messages.length) {
      render({id: 'intro', role: 'dexter', status: 'complete', content: snapshot.enabled
        ? 'Local AI is on' + (snapshot.model ? ' (' + snapshot.model + ')' : '') + '. I will answer. Briefly.'
        : 'No model is connected. I will reply anyway, unhelpfully. Commands like /treat and /status work regardless.'});
    }
  }
  ui.on('chat:event', event => {
    if (event.type === 'message') { nodes.get('intro')?.remove(); nodes.delete('intro'); render(event.message); if (event.message.status === 'streaming') setBusy(event.message.id); }
    else if (event.type === 'thinking') {
      pill.textContent = 'Thinking…';
      pill.dataset.status = 'streaming';
    } else if (event.type === 'token') {
      const li = nodes.get(event.id);
      if (li) { const body = li.querySelector('.body'); body.textContent = (body.textContent === '…' ? '' : body.textContent) + event.text; log.scrollTop = log.scrollHeight; }
    } else if (event.type === 'done') {
      render({id: event.id, role: 'assistant', status: event.status, content: event.text, citations: event.citations});
      setBusy(null);
      if (event.detail && event.status !== 'complete') showNotice(event.detail);
    } else if (event.type === 'reset') reset(event.snapshot);
    else if (event.type === 'route') $('route').textContent = event.path === 'local_ai' ? '' : 'Handled ' + (event.path === 'command' ? 'locally' : 'without a model') + ': ' + event.reason + '.';
    else if (event.type === 'compact') setCompact(event.compact);
    if (event.type === 'done') $('retry').hidden = !(event.status === 'error' || event.status === 'cancelled');
  });
  ui.on('chat:status', setStatus);
  ui.on('ai:models-updated', data => {
    updateModelPicker({enabled: true, models: data.models, currentModel: data.currentModel});
  });
  modelPick?.addEventListener('change', () => {
    const chosen = modelPick.value;
    if (chosen) {
      ui.invoke('chat:set-model', chosen);
      showNotice('Model: ' + chosen);
      setTimeout(() => showNotice(''), 2000);
    }
  });
  ui.on('settings:changed', s => {
    $('memory').textContent = s.settings.rememberConversation ? 'Remembered on this computer.' : 'Not remembered after quitting.';
    $('mic').hidden = !s.settings.sttEnabled; setCompact(s.settings.chatCompact);
  });
  $('compact').addEventListener('click', () => ui.invoke('chat:compact', !document.body.classList.contains('compact')).then(setCompact));
  $('snap').addEventListener('click', () => ui.invoke('chat:snap'));
  $('packet').addEventListener('click', async () => { const r = await ui.invoke('chat:packet'); showNotice(r.saved ? '' : 'Packet not saved.'); });
  $('retry').addEventListener('click', () => { $('retry').hidden = true; ui.invoke('chat:retry'); });

  // Push-to-talk (optional): records only between two clicks, at most 30 s, and only after
  // the user enabled speech input. The transcript is placed in the box for review, never sent.
  let recorder = null, chunks = [], stream = null, stopTimer = null;
  async function startRecording() {
    const ready = await ui.invoke('stt:prepare');
    if (!ready.ok) { showNotice(ready.detail); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false}); }
    catch (error) { showNotice('Microphone unavailable: ' + error.message); return; }
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = finishRecording;
    recorder.start();
    $('mic').setAttribute('aria-pressed', 'true'); showNotice('Listening. Click the microphone again to stop.');
    stopTimer = setTimeout(stopRecording, 30000);
  }
  function stopRecording() {
    clearTimeout(stopTimer);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    $('mic').setAttribute('aria-pressed', 'false');
  }
  async function finishRecording() {
    recorder = null;
    try {
      showNotice('Transcribing locally…');
      const blob = new Blob(chunks, {type: chunks[0]?.type || 'audio/webm'}); chunks = [];
      const context = new AudioContext();
      const audio = await context.decodeAudioData(await blob.arrayBuffer());
      void context.close();
      const bytes = window.DexterWav.encodeWav(window.DexterWav.downsample(audio.getChannelData(0), audio.sampleRate));
      const r = await ui.invoke('stt:transcribe', bytes);
      if (r.ok) { input.value = (input.value ? input.value + ' ' : '') + r.text; showNotice(''); input.focus(); }
      else showNotice('Transcription failed: ' + r.detail);
    } catch (error) { showNotice('Could not process the recording: ' + error.message); }
  }
  $('mic').addEventListener('click', () => { if (recorder) stopRecording(); else void startRecording(); });
  window.addEventListener('pagehide', stopRecording);

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
