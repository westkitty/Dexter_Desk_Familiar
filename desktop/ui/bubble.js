'use strict';
(() => {
  const ui = window.dexterUI;
  const bubble = document.getElementById('bubble');
  const text = document.getElementById('text');
  const choicesContainer = document.getElementById('choices');
  const more = document.getElementById('more');
  const snapBtn = document.getElementById('snap');
  const resetBtn = document.getElementById('reset');
  const closeBtn = document.getElementById('close');

  let timer = null;

  ui.on('bubble:show', payload => {
    clearTimeout(timer);
    text.textContent = String(payload.text || '').slice(0, 400);
    more.hidden = payload.kind !== 'reply';

    // Clear and build check-in choices if present
    choicesContainer.replaceChildren();
    if (payload.kind === 'checkin' && Array.isArray(payload.choices)) {
      payload.choices.slice(0, 4).forEach((label, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'choice-button';
        button.textContent = String(label).slice(0, 40);
        const path = (Array.isArray(payload.path) ? payload.path : []).concat([index]);
        button.addEventListener('click', () => {
          clearTimeout(timer);
          ui.invoke('bubble:answer', {id: String(payload.id), path});
        });
        choicesContainer.appendChild(button);
      });
    }

    bubble.hidden = false;
    const ms = Number.isFinite(payload.timeoutMs) ? Math.min(120000, Math.max(2000, payload.timeoutMs)) : 6000;
    timer = setTimeout(() => ui.invoke('bubble:dismiss'), ms);
  });

  closeBtn?.addEventListener('click', () => {
    clearTimeout(timer);
    ui.invoke('bubble:dismiss');
  });

  more?.addEventListener('click', () => {
    clearTimeout(timer);
    ui.invoke('bubble:open-chat');
  });

  snapBtn?.addEventListener('click', () => {
    ui.invoke('bubble:snap');
  });

  resetBtn?.addEventListener('click', () => {
    ui.invoke('bubble:reset');
  });
})();
