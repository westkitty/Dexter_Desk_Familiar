// Native-window adapter for the pet window. Does not read other apps, keyboard
// events outside this window, browser tabs or the screen.
const native = window.dexterDesktop;
if (native) {
  const pet = document.getElementById('pet');
  const thought = document.getElementById('thought');
  const art = {cel: document.getElementById('celModeToggle'), atlas: document.getElementById('atlasPreviewToggle')};
  let tracking = null;
  let hintTimeout = null;
  let lastHover = null;
  let lastPointer = null;
  let prefs = {tts: {enabled: false, engine: 'system', volume: 0.8, rate: 1, voice: ''}};
  const hitTest = window.DexterHitTest;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskCanvas.height = hitTest?.MASK_SIZE || 64;
  const maskContext = maskCanvas.getContext('2d', {willReadFrequently: true});
  let cachedMask = {source: null, key: '', data: null, sampledAt: -Infinity};

  // ------------------------------------------------------------ bubble (desktop only DOM)
  const bubble = document.createElement('section');
  bubble.className = 'desktop-bubble';
  bubble.hidden = true;
  bubble.setAttribute('aria-live', 'polite');
  bubble.setAttribute('aria-label', 'Dexter says');
  bubble.innerHTML = '<p class="desktop-bubble-text"></p><div class="desktop-bubble-choices" role="group" aria-label="Answer Dexter"></div>' +
    '<div class="desktop-bubble-foot"><button type="button" class="desktop-bubble-more" hidden>Open conversation</button>' +
    '<button type="button" class="desktop-bubble-close" aria-label="Dismiss">×</button></div>';
  document.body.appendChild(bubble);
  const bubbleText = bubble.querySelector('.desktop-bubble-text');
  const bubbleChoices = bubble.querySelector('.desktop-bubble-choices');
  const bubbleMore = bubble.querySelector('.desktop-bubble-more');
  let bubbleTimer = null, bubbleKind = null;

  // Typewriter reveal (adapted from WESTCAT-OVERLAY-RELOADED's poll overlay).
  // Screen readers get the whole text at once via aria-label; motion settings bypass it.
  let typeTimer = null;
  function typewrite(text) {
    clearInterval(typeTimer); typeTimer = null;
    bubbleText.setAttribute('aria-label', text);
    if (!prefs.typewriter || reducedMotion() || text.length < 4) { bubbleText.textContent = text; return; }
    const cps = Math.min(120, Math.max(15, Number(prefs.typewriterCps) || 45));
    let shown = 0;
    bubbleText.textContent = '';
    typeTimer = setInterval(() => {
      shown = Math.min(text.length, shown + Math.max(1, Math.round(cps / 30)));
      bubbleText.textContent = text.slice(0, shown);
      if (shown >= text.length) { clearInterval(typeTimer); typeTimer = null; }
    }, 33);
  }
  function hideBubble(notify = true) {
    clearInterval(typeTimer); typeTimer = null;
    clearTimeout(bubbleTimer); bubbleTimer = null;
    const wasCheckin = bubbleKind === 'checkin';
    bubble.hidden = true; bubbleKind = null;
    bubbleChoices.replaceChildren();
    document.body.classList.remove('desktop-bubble-open');
    document.body.classList.remove('desktop-bubble-flip');
    if (notify) native.dismissBubble();
    if (lastPointer && !tracking) syncHover(lastPointer.x, lastPointer.y);
    return wasCheckin;
  }
  function showBubble(payload) {
    if (payload.kind === 'hide') { hideBubble(false); return; }
    clearTimeout(bubbleTimer);
    bubbleKind = payload.kind;
    document.body.classList.toggle('desktop-bubble-flip', Boolean(payload.flipBubble));
    typewrite(String(payload.text || '').slice(0, 400));
    bubbleChoices.replaceChildren();
    if (payload.kind === 'checkin' && Array.isArray(payload.choices)) {
      payload.choices.slice(0, 4).forEach((label, index) => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = String(label).slice(0, 40);
        const path = (Array.isArray(payload.path) ? payload.path : []).concat([index]);
        button.addEventListener('click', () => { hideBubble(false); native.answer(String(payload.id), path); });
        bubbleChoices.appendChild(button);
      });
    }
    bubbleMore.hidden = payload.kind !== 'reply';
    bubble.hidden = false;
    document.body.classList.add('desktop-bubble-open');
    const ms = Number.isFinite(payload.timeoutMs) ? Math.min(120000, Math.max(2000, payload.timeoutMs)) : 6000;
    bubbleTimer = setTimeout(() => hideBubble(true), ms);
  }
  bubble.querySelector('.desktop-bubble-close').addEventListener('click', () => hideBubble(true));
  bubbleMore.addEventListener('click', () => { hideBubble(true); native.openChat(); });
  native.onBubble(showBubble);

  // ------------------------------------------------------------ hit testing
  function visibleMedia() {
    for (const id of ['celVideo', 'celPoster', 'atlasCanvas', 'sprite']) {
      const element = document.getElementById(id);
      if (element && !element.hidden && getComputedStyle(element).display !== 'none') return element;
    }
    return null;
  }
  function sourceSize(element) {
    if (element.tagName === 'VIDEO') return [element.videoWidth, element.videoHeight];
    if (element.tagName === 'IMG') return [element.naturalWidth, element.naturalHeight];
    return [element.width, element.height];
  }
  function isOverBubble(x, y) {
    if (bubble.hidden) return false;
    return hitTest?.within(bubble.getBoundingClientRect(), x, y) === true;
  }
  function isOverPet(x, y) {
    if (isOverBubble(x, y)) return true;
    const box = pet.getBoundingClientRect();
    if (!hitTest?.within(box, x, y)) return false;
    if (tracking) return true;
    const media = visibleMedia();
    if (!media || !maskContext) return true; // Never strand Dexter if pixel sampling is unsupported.
    const [width, height] = sourceSize(media);
    if (!width || !height) return true;
    const now = performance.now();
    const key = media.currentSrc || media.src || String(media.width) + 'x' + String(media.height);
    const animated = media.tagName === 'VIDEO' || media.tagName === 'CANVAS';
    if (cachedMask.source !== media || cachedMask.key !== key || (animated && now - cachedMask.sampledAt > 100)) {
      let data = null;
      const contained = hitTest.containedRect(width, height, maskCanvas.width, maskCanvas.height);
      if (contained) {
        try {
          maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
          maskContext.drawImage(media, contained.x, contained.y, contained.width, contained.height);
          data = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        } catch {
          // A tainted or unsupported decoder must not make the familiar inaccessible.
        }
      }
      cachedMask = {source: media, key, data, sampledAt: now};
    }
    const alphaHit = hitTest.alphaAt(cachedMask.data, box, x, y, {flipped: document.body.classList.contains('desktop-flipped')});
    return alphaHit === null ? true : alphaHit;
  }
  function syncHover(x, y) {
    const overPet = isOverPet(x, y);
    if (overPet !== lastHover) { lastHover = overPet; native.hit(overPet); }
  }

  // ------------------------------------------------------------ preferences
  function setArt(mode) {
    for (const [key, checkbox] of Object.entries(art)) {
      const wanted = mode === key;
      if (checkbox.checked !== wanted) {
        checkbox.checked = wanted;
        checkbox.dispatchEvent(new Event('change', {bubbles: true}));
      }
    }
  }
  function setControl(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') { if (el.checked === value) return; el.checked = value; }
    else { if (el.value === String(value)) return; el.value = String(value); }
    el.dispatchEvent(new Event('change', {bubbles: true}));
  }
  const systemReduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return prefs.motion === 'reduced' || (prefs.motion !== 'full' && Boolean(systemReduced?.matches)); }
  const INTENSITY = {reserved: {hourlyCap: 1, minGapMs: 900000}, standard: {hourlyCap: 3, minGapMs: 240000}, attentive: {hourlyCap: 6, minGapMs: 120000}};
  function applyPrefs(next) {
    const previousIntensity = prefs.intensity;
    prefs = {...prefs, ...next, tts: {...prefs.tts, ...(next.tts || {})}};
    setControl('quietToggle', prefs.quiet === true);
    setControl('soundToggle', prefs.sound === true);
    setControl('motionToggle', reducedMotion());
    if ([30, 60, 120, 300].includes(prefs.idleSeconds)) setControl('idleSelect', prefs.idleSeconds);
    if (['pixel', 'cel', 'atlas'].includes(prefs.art)) setArt(prefs.art);
    document.body.classList.toggle('desktop-flipped', prefs.flipped === true);
    document.body.dataset.bubbleSize = ['small', 'medium', 'large'].includes(prefs.bubbleTextSize) ? prefs.bubbleTextSize : 'medium';
    document.body.classList.toggle('desktop-high-contrast', prefs.highContrastBubble === true);
    if (prefs.intensity !== previousIntensity && INTENSITY[prefs.intensity])
      document.dispatchEvent(new CustomEvent('dexter-desktop-intensity', {detail: INTENSITY[prefs.intensity]}));
    if (!prefs.tts.enabled) speech.cancel();
    applyAnimationSpeed();
    cachedMask.source = null;
    resetNoseClicks();
  }
  systemReduced?.addEventListener?.('change', () => setControl('motionToggle', reducedMotion()));

  // ------------------------------------------------------------ speech output (optional)
  const synth = window.speechSynthesis || null;
  let audio = null, audioUrl = null;
  function stopAudio() {
    if (audio) { try { audio.pause(); } catch {} audio = null; }
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  }
  function localVoices() { return synth ? synth.getVoices().filter(v => v.localService) : []; }
  function waitVoices() {
    if (!synth || localVoices().length) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => { synth.removeEventListener('voiceschanged', done); clearTimeout(timer); resolve(); };
      const timer = setTimeout(done, 1200);
      synth.addEventListener('voiceschanged', done);
    });
  }
  async function systemSpeak(text) {
    if (!synth || typeof SpeechSynthesisUtterance !== 'function') throw new Error('System speech is unavailable on this computer');
    await waitVoices();
    const voices = localVoices();
    // Only on-device voices: never a network voice.
    if (!voices.length) throw new Error('No on-device system voice is available');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voices.find(v => v.name === prefs.tts.voice) || voices.find(v => v.default) || voices[0];
    utterance.volume = prefs.tts.volume; utterance.rate = prefs.tts.rate; utterance.pitch = 0.85;
    await new Promise((resolve, reject) => {
      utterance.onend = resolve;
      utterance.onerror = event => event.error === 'interrupted' || event.error === 'canceled' ? resolve() : reject(new Error(event.error || 'speech error'));
      synth.speak(utterance);
    });
  }
  async function piperSpeak(text) {
    const bytes = await native.synthesize(text);
    stopAudio();
    audioUrl = URL.createObjectURL(new Blob([bytes], {type: 'audio/wav'}));
    const player = new Audio(audioUrl);
    audio = player;
    player.volume = prefs.tts.volume;
    await new Promise((resolve, reject) => {
      player.onended = resolve; player.onpause = resolve;
      player.onerror = () => reject(new Error('Could not play Piper audio'));
      player.play().catch(reject);
    });
    if (audio === player) stopAudio();
  }
  const speech = window.DexterSpeechQueue.createSpeechQueue({
    speak: text => prefs.tts.engine === 'piper' ? piperSpeak(text) : systemSpeak(text),
    stop: () => { try { synth?.cancel(); } catch {} stopAudio(); native.cancelSynthesis(); },
    onState: (s, detail) => native.speechState(s, detail)
  });
  native.onSpeech(message => {
    if (message.op === 'cancel') speech.cancel();
    else if (message.op === 'say' && prefs.tts.enabled && !document.hidden) speech.enqueue(String(message.text || ''), {interrupt: message.interrupt === true});
  });

  // ------------------------------------------------------------ actions, signals, status
  function hint(message) {
    if (hintTimeout) clearTimeout(hintTimeout);
    thought.textContent = message;
    document.body.classList.add('desktop-has-thought');
    hintTimeout = setTimeout(() => document.body.classList.remove('desktop-has-thought'), 2200);
  }
  function showThoughtBriefly(ms = 2600) {
    document.body.classList.add('desktop-has-thought');
    if (hintTimeout) clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => document.body.classList.remove('desktop-has-thought'), ms);
  }
  function action(name) {
    if (name === 'pixel' || name === 'cel' || name === 'atlas') {
      setArt(name);
      hint(name === 'pixel' ? 'Original pixel Dexter.' : name === 'cel' ? 'Cel-shaded Dexter. Your decision.' : 'Candidate atlas, not canon-approved.');
    } else {
      document.querySelector('[data-action="' + name + '"]')?.click();
      showThoughtBriefly();
    }
  }
  native.onAction(action);
  native.onPrefs(applyPrefs);
  native.onSignal(detail => {
    document.dispatchEvent(new CustomEvent('dexter-desktop-signal', {detail: {
      state: String(detail.state || ''), priority: Number(detail.priority) || 50, ms: Number(detail.ms) || 1500, line: String(detail.line || '').slice(0, 200)}}));
    if (detail.line) showThoughtBriefly(3200);
  });
  const napLabel = document.getElementById('napLabel');
  let reported = '';
  function reportStatus() {
    const napping = napLabel?.textContent === 'Wake';
    const key = pet.dataset.state + '|' + napping;
    if (key === reported) return;
    reported = key;
    native.status(pet.dataset.state || 'idle', napping);
  }
  const observer = new MutationObserver(reportStatus);
  observer.observe(pet, {attributes: true, attributeFilter: ['data-state']});
  if (napLabel) observer.observe(napLabel, {childList: true, characterData: true, subtree: true});

  // ------------------------------------------------------------ one-shot tricks and animation speed
  // Easing one-shots adapted from WESTCAT-OVERLAY-RELOADED's out_cubic / out_back
  // cluster easing and its sneeze/drop gags. Skipped entirely under reduced motion.
  const GAGS = {
    hop: {frames: [{translate: '0 0'}, {translate: '0 -14%'}, {translate: '0 0'}], ms: 520, easing: 'cubic-bezier(.34,1.56,.64,1)'},
    sneeze: {frames: [{scale: '1 1'}, {scale: '1.04 0.94', offset: 0.35}, {scale: '0.97 1.05', offset: 0.55}, {scale: '1 1'}], ms: 620, easing: 'cubic-bezier(.33,1,.68,1)', line: 'Hff—tchoo. That did not happen.'},
    shake: {frames: [{rotate: '0deg'}, {rotate: '-4deg'}, {rotate: '4deg'}, {rotate: '-2deg'}, {rotate: '0deg'}], ms: 480, easing: 'ease-out'},
    drop: {frames: [{translate: '0 -40%', opacity: 0}, {translate: '0 0', opacity: 1}], ms: 640, easing: 'cubic-bezier(.34,1.56,.64,1)'}
  };
  const gagTarget = pet.querySelector('.sprite') ? pet : pet;
  function playGag(name) {
    const g = GAGS[name];
    if (!g || reducedMotion() || document.hidden) return;
    const media = visibleMedia() || gagTarget;
    try { media.animate(g.frames, {duration: g.ms / (Number(prefs.animationSpeed) || 1), easing: g.easing}); } catch {}
    if (g.line && !prefs.quiet) hint(g.line);
  }
  native.onGag(playGag);
  function applyAnimationSpeed() {
    const rate = Math.min(2, Math.max(0.5, Number(prefs.animationSpeed) || 1));
    const video = document.getElementById('celVideo');
    if (video) video.playbackRate = rate;
    for (const a of document.getAnimations ? document.getAnimations() : []) { try { a.playbackRate = rate; } catch {} }
  }
  document.addEventListener('animationstart', applyAnimationSpeed);
  document.getElementById('celVideo')?.addEventListener('play', applyAnimationSpeed);
  // Nose-only developer unlock: five quick clicks directly on Dexter's nose
  // when developer tools are enabled in settings. Any drag, body poke, timeout (2000ms),
  // or art/scale change resets the sequence.
  let noseClicks = [];
  function resetNoseClicks() {
    noseClicks = [];
  }
  function handlePetClick(clientX, clientY) {
    const media = visibleMedia();
    if (!media) {
      resetNoseClicks();
      return;
    }
    const mediaBounds = media.getBoundingClientRect();
    const hitApi = window.DexterHitTest;
    const isNose = hitApi && hitApi.isNoseHit(
      prefs.art || 'pixel',
      mediaBounds,
      clientX,
      clientY,
      {flipped: Boolean(prefs.flipped), mask: cachedMask.source === media ? cachedMask : null}
    );
    if (!isNose) {
      resetNoseClicks();
      return;
    }
    const now = performance.now();
    noseClicks = noseClicks.filter(t => now - t < 2000).concat(now);
    if (noseClicks.length >= 5) {
      noseClicks = [];
      native.devUnlock();
    }
  }

  // ------------------------------------------------------------ pointer: hover routing, drag, poke
  // Forward only a boolean hit test within this overlay, never coordinates or a history.
  document.addEventListener('mousemove', event => {
    lastPointer = {x: event.clientX, y: event.clientY};
    syncHover(lastPointer.x, lastPointer.y);
  }, {passive: true});
  document.addEventListener('mouseleave', () => { lastPointer = null; lastHover = false; native.hit(false); });
  // Video movement can change the character's actual opaque footprint under a still cursor.
  document.getElementById('celVideo')?.addEventListener('timeupdate', () => { if (lastPointer && !tracking) syncHover(lastPointer.x, lastPointer.y); });
  for (const id of ['sprite', 'celPoster']) {
    document.getElementById(id)?.addEventListener('load', () => {
      cachedMask.source = null;
      if (lastPointer && !tracking) syncHover(lastPointer.x, lastPointer.y);
    });
  }
  // Capture window dragging without letting the original in-habitat move handlers run.
  pet.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.stopPropagation();
    tracking = {
      x: event.screenX, y: event.screenY,
      originX: event.screenX, originY: event.screenY,
      clientX: event.clientX, clientY: event.clientY,
      moved: false
    };
    try { pet.setPointerCapture(event.pointerId); } catch {}
    native.hit(true);
  });
  pet.addEventListener('pointermove', event => {
    if (!tracking) return;
    event.stopPropagation();
    const total = Math.abs(event.screenX - tracking.originX) + Math.abs(event.screenY - tracking.originY);
    if (!tracking.moved && total < 7) return;
    const dx = event.screenX - tracking.x, dy = event.screenY - tracking.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 80 || Math.abs(dy) > 80) return;
    tracking.x = event.screenX; tracking.y = event.screenY; tracking.moved = true;
    native.move(dx, dy);
  }, {passive: true});
  function endDrag(cancelled = false) {
    if (!tracking) return;
    const wasMoved = tracking.moved;
    const clickPos = {x: tracking.clientX, y: tracking.clientY};
    tracking = null;
    native.endDrag();
    if (!cancelled) {
      if (wasMoved) {
        resetNoseClicks();
        document.dispatchEvent(new Event('dexter-desktop-moved'));
      } else {
        handlePetClick(clickPos.x, clickPos.y);
        document.dispatchEvent(new Event('dexter-desktop-poke'));
      }
      showThoughtBriefly();
    } else {
      resetNoseClicks();
    }
  }
  pet.addEventListener('pointerup', event => { event.stopPropagation(); endDrag(); });
  pet.addEventListener('pointercancel', event => { event.stopPropagation(); endDrag(true); });
  pet.addEventListener('contextmenu', event => { event.preventDefault(); native.menu(); });
  bubble.addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !bubble.hidden) hideBubble(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { endDrag(true); native.hit(false); speech.cancel(); }
  });
  window.addEventListener('pagehide', () => { observer.disconnect(); speech.cancel(); clearTimeout(bubbleTimer); clearTimeout(hintTimeout); clearInterval(typeTimer); document.removeEventListener('animationstart', applyAnimationSpeed); });
  // The browser version's initial slogan stays out of the tiny transparent overlay.
  document.body.classList.remove('desktop-has-thought');
  reportStatus();
}
