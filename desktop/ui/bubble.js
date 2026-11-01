'use strict';
(() => {
  const ui = window.dexterUI;
  const bubble = document.getElementById('bubble'), text = document.getElementById('text'), more = document.getElementById('more');
  let timer = null;
  ui.on('bubble:show', payload => {
    clearTimeout(timer);
    text.textContent = String(payload.text || '').slice(0, 400);
    more.hidden = payload.kind !== 'reply';
    bubble.hidden = false;
    const ms = Number.isFinite(payload.timeoutMs) ? Math.min(120000, Math.max(2000, payload.timeoutMs)) : 6000;
    timer = setTimeout(() => ui.invoke('bubble:dismiss'), ms);
  });
  document.getElementById('close').addEventListener('click', () => { clearTimeout(timer); ui.invoke('bubble:dismiss'); });
  more.addEventListener('click', () => { clearTimeout(timer); ui.invoke('bubble:open-chat'); });
})();
