// Native-window adapter. Does not read other apps, keyboard events or browser tabs.
const native = window.dexterDesktop;
if (native) {
  const pet = document.getElementById('pet');
  const thought = document.getElementById('thought');
  const art = {cel: document.getElementById('celModeToggle'), atlas: document.getElementById('atlasPreviewToggle')};
  let tracking = null;
  let hintTimeout = null;
  let lastHover = null;

  function isOverPet(x, y) {
    const box = pet.getBoundingClientRect();
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }
  function setArt(mode) {
    for (const [key, checkbox] of Object.entries(art)) {
      const wanted = mode === key;
      if (checkbox.checked !== wanted) {
        checkbox.checked = wanted;
        checkbox.dispatchEvent(new Event('change', {bubbles:true}));
      }
    }
  }
  function hint(message) {
    if (hintTimeout) clearTimeout(hintTimeout);
    thought.textContent = message;
    document.body.classList.add('desktop-has-thought');
    hintTimeout = setTimeout(() => document.body.classList.remove('desktop-has-thought'), 2200);
  }
  function action(name) {
    if (name === 'pixel' || name === 'cel' || name === 'atlas') {
      setArt(name);
      hint(name === 'pixel' ? 'Original pixel Dexter.' : name === 'cel' ? 'Cel-shaded Dexter. Your decision.' : 'Candidate atlas, not canon-approved.');
    } else if (name === 'quiet') {
      const setting = document.getElementById('quietToggle');
      setting.checked = !setting.checked;
      setting.dispatchEvent(new Event('change', {bubbles:true}));
      hint(setting.checked ? 'Silence. A reasonable policy.' : 'Complaints may resume.');
    } else {
      document.querySelector('[data-action="' + name + '"]')?.click();
      document.body.classList.add('desktop-has-thought');
      if (hintTimeout) clearTimeout(hintTimeout);
      hintTimeout = setTimeout(() => document.body.classList.remove('desktop-has-thought'), 2600);
    }
  }
  native.onAction(action);
  // Forward only a boolean hit test within this overlay, never coordinates or a history.
  document.addEventListener('mousemove', event => {
    const overPet = isOverPet(event.clientX, event.clientY);
    if (overPet !== lastHover) {lastHover = overPet;native.hit(overPet);}
  }, {passive:true});
  document.addEventListener('mouseleave', () => {lastHover = false;native.hit(false);});
  pet.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    tracking = {x:event.screenX, y:event.screenY, moved:false};
  });
  pet.addEventListener('pointermove', event => {
    if (!tracking) return;
    const dx = event.screenX - tracking.x;
    const dy = event.screenY - tracking.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    tracking.x = event.screenX;tracking.y = event.screenY;
    if (Math.abs(dx) > 80 || Math.abs(dy) > 80) return;
    tracking.moved = true;
    native.move(dx, dy);
  }, {passive:true});
  function endDrag() {if (tracking) {tracking = null;native.endDrag();}}
  pet.addEventListener('pointerup', endDrag);
  pet.addEventListener('pointercancel', endDrag);
  pet.addEventListener('contextmenu', event => {event.preventDefault(); native.menu();});
  document.addEventListener('visibilitychange', () => {if(document.hidden){endDrag();native.hit(false);}});
  // The browser version's initial slogan stays out of the tiny transparent overlay.
  document.body.classList.remove('desktop-has-thought');
}
