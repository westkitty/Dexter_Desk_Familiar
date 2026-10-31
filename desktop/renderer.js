// Native-window adapter. Does not read other apps, keyboard events or browser tabs.
const native = window.dexterDesktop;
if (native) {
  const pet = document.getElementById('pet');
  const thought = document.getElementById('thought');
  const art = {cel: document.getElementById('celModeToggle'), atlas: document.getElementById('atlasPreviewToggle')};
  let tracking = null;
  let hintTimeout = null;
  let lastHover = null;
  let lastPointer = null;
  const hitTest = window.DexterHitTest;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskCanvas.height = hitTest?.MASK_SIZE || 64;
  const maskContext = maskCanvas.getContext('2d', {willReadFrequently:true});
  let cachedMask = {source:null, key:'', data:null, sampledAt:-Infinity};

  function visibleMedia() {
    for (const id of ['celVideo','celPoster','atlasCanvas','sprite']) {
      const element = document.getElementById(id);
      if (element && !element.hidden && getComputedStyle(element).display !== 'none') return element;
    }
    return null;
  }
  function sourceSize(element) {
    if (element.tagName === 'VIDEO') return [element.videoWidth,element.videoHeight];
    if (element.tagName === 'IMG') return [element.naturalWidth,element.naturalHeight];
    return [element.width,element.height];
  }
  function isOverPet(x,y) {
    const box=pet.getBoundingClientRect();
    if(!hitTest?.within(box,x,y))return false;
    if(tracking)return true;
    const media=visibleMedia();
    if(!media || !maskContext)return true; // Never strand Dexter if pixel sampling is unsupported.
    const [width,height]=sourceSize(media);
    if(!width || !height)return true;
    const now=performance.now();
    const key=media.currentSrc || media.src || String(media.width)+'x'+String(media.height);
    const animated=media.tagName==='VIDEO'||media.tagName==='CANVAS';
    if(cachedMask.source!==media || cachedMask.key!==key ||
      (animated && now-cachedMask.sampledAt>100)){
      let data=null;
      const contained=hitTest.containedRect(width,height,maskCanvas.width,maskCanvas.height);
      if(contained){
        try{
          maskContext.clearRect(0,0,maskCanvas.width,maskCanvas.height);
          maskContext.drawImage(media,contained.x,contained.y,contained.width,contained.height);
          data=maskContext.getImageData(0,0,maskCanvas.width,maskCanvas.height);
        }catch{
          // A tainted or unsupported decoder must not make the familiar inaccessible.
        }
      }
      cachedMask={source:media,key,data,sampledAt:now};
    }
    const alphaHit=hitTest.alphaAt(cachedMask.data,box,x,y,{
      flipped:document.body.classList.contains('desktop-flipped')
    });
    return alphaHit===null?true:alphaHit;
  }
  function syncHover(x,y) {
    const overPet=isOverPet(x,y);
    if(overPet!==lastHover){lastHover=overPet;native.hit(overPet);}
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
    } else if (name === 'flip') {
      document.body.classList.toggle('desktop-flipped');
      hint('Direction changed. Judgment unchanged.');
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
    lastPointer={x:event.clientX,y:event.clientY};
    syncHover(lastPointer.x,lastPointer.y);
  },{passive:true});
  document.addEventListener('mouseleave', ()=>{
    lastPointer=null;lastHover=false;native.hit(false);
  });
  // Video movement can change the character's actual opaque footprint under a still cursor.
  document.getElementById('celVideo')?.addEventListener('timeupdate',()=>{
    if(lastPointer && !tracking)syncHover(lastPointer.x,lastPointer.y);
  });
  for(const id of ['sprite','celPoster']){
    document.getElementById(id)?.addEventListener('load',()=>{
      cachedMask.source=null;
      if(lastPointer && !tracking)syncHover(lastPointer.x,lastPointer.y);
    });
  }
  // Capture window dragging without letting the original in-habitat move handlers run.
  pet.addEventListener('pointerdown', event => {
    if(event.button !== 0) return;
    event.stopPropagation();
    tracking={x:event.screenX,y:event.screenY,originX:event.screenX,originY:event.screenY,moved:false};
    try{pet.setPointerCapture(event.pointerId);}catch{}
    native.hit(true);
  });
  pet.addEventListener('pointermove', event => {
    if(!tracking)return;
    event.stopPropagation();
    const total=Math.abs(event.screenX-tracking.originX)+Math.abs(event.screenY-tracking.originY);
    if(!tracking.moved && total<7)return;
    const dx=event.screenX-tracking.x,dy=event.screenY-tracking.y;
    if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>80||Math.abs(dy)>80)return;
    tracking.x=event.screenX;tracking.y=event.screenY;tracking.moved=true;
    native.move(dx,dy);
  },{passive:true});
  function endDrag(cancelled=false){
    if(!tracking)return;
    const wasMoved=tracking.moved;
    tracking=null;
    native.endDrag();
    if(!cancelled)document.dispatchEvent(new Event(wasMoved?'dexter-desktop-moved':'dexter-desktop-poke'));
  }
  pet.addEventListener('pointerup', event=>{event.stopPropagation();endDrag();});
  pet.addEventListener('pointercancel', event=>{event.stopPropagation();endDrag(true);});
  pet.addEventListener('contextmenu', event => {event.preventDefault(); native.menu();});
  document.addEventListener('visibilitychange', () => {if(document.hidden){endDrag(true);native.hit(false);}});
  // The browser version's initial slogan stays out of the tiny transparent overlay.
  document.body.classList.remove('desktop-has-thought');
}
