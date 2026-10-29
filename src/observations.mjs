// The input contract deliberately sees only key metadata, never textarea contents.
export function isCountedKey(event) {
  if(!event||event.isComposing||event.repeat||event.ctrlKey||event.metaKey||event.altKey) return false;
  if(["Dead","Process","Unidentified","Escape","Tab","Shift","Control","Alt","Meta","CapsLock"].includes(event.key)) return false;
  return typeof event.key==="string"&&(event.key.length===1||["Backspace","Delete","Enter"].includes(event.key));
}
export function countRecentKeys(timestamps,now,windowMs=6000) {
  if(!Array.isArray(timestamps)||!Number.isFinite(now)||!Number.isFinite(windowMs)||windowMs<=0) return 0;
  return timestamps.filter(time=>Number.isFinite(time)&&time<=now&&now-time<windowMs).length;
}
