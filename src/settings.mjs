export const STORAGE_KEY="dexter-desk-familiar:prefs:v1";
export const IDLE_OPTIONS=Object.freeze([30,60,120,300]);
export function defaultSettings(systemReducedMotion=false) {
  return {sound:false,quiet:false,reducedMotion:Boolean(systemReducedMotion),idleSeconds:60};
}
export function sanitizeSettings(candidate,systemReducedMotion=false) {
  const defaults=defaultSettings(systemReducedMotion);
  if(!candidate||typeof candidate!=="object"||Array.isArray(candidate)) return defaults;
  const result={...defaults};
  for(const key of ["sound","quiet","reducedMotion"]) if(typeof candidate[key]==="boolean") result[key]=candidate[key];
  if(IDLE_OPTIONS.includes(candidate.idleSeconds)) result.idleSeconds=candidate.idleSeconds;
  return result;
}
export function readSettings(storage,systemReducedMotion=false) {
  try{return sanitizeSettings(JSON.parse(storage?.getItem(STORAGE_KEY)??"null"),systemReducedMotion);}
  catch{return defaultSettings(systemReducedMotion);}
}
export function writeSettings(storage,settings) {
  try{storage?.setItem(STORAGE_KEY,JSON.stringify(sanitizeSettings(settings)));return true;}catch{return false;}
}
export function resetSettings(storage) {
  try{storage?.removeItem(STORAGE_KEY);return true;}catch{return false;}
}
