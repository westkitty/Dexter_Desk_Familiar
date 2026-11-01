'use strict';
// Deterministic command router (adapted from Westcat_Familiar/commandRouter.ts).
// Order of preference: exact slash command → deterministic natural-language
// intent → local model (if the user enabled it) → offline reply. Never a cloud model.
const INTENTS = [
  {name: '/status', re: /\b(status|how are you doing|what('?s| is) (your|the) state)\b/i},
  {name: '/mode', re: /\bwhat mode\b|\bwhich mode\b/i},
  {name: '/mode-set', re: /\b(switch|change|go|set)\b.*\b(plain|work|build|crisis|dex|quiet|chat)\b(\s+mode)?/i},
  {name: '/treat', re: /\b(have|want|here'?s|give( you)?) (a )?treat\b/i},
  {name: '/session-start', re: /\bstart (a )?(work |focus )?session\b/i},
  {name: '/session-stop', re: /\b(stop|end|finish) (the |my )?session\b/i},
  {name: '/session-pause', re: /\bpause (the |my )?session\b/i},
  {name: '/session-resume', re: /\bresume (the |my )?session\b/i},
  {name: '/time', re: /\bhow (much time|long)\b.*\b(left|remaining)\b/i},
  {name: '/checkin', re: /\bcheck in (with me|now)\b/i},
  {name: '/sneeze', re: /\bsneeze\b/i}
];
function route(text, {aiEnabled = false} = {}) {
  const t = String(text || '').trim();
  if (!t) return {path: 'none', reason: 'empty'};
  if (t.startsWith('/')) {
    const [name, ...rest] = t.split(/\s+/);
    return {path: 'command', command: name.toLowerCase(), args: rest.join(' '), reason: 'slash command'};
  }
  if (t.length <= 80) {
    for (const intent of INTENTS) {
      const m = intent.re.exec(t);
      if (!m) continue;
      if (intent.name === '/mode-set') {
        const mode = /\b(plain|work|build|crisis|dex|quiet|chat)\b/i.exec(t)[1].toLowerCase();
        return {path: 'command', command: '/mode', args: mode, reason: 'recognised request: change mode'};
      }
      const [command, sub] = intent.name.split('-');
      return {path: 'command', command, args: sub || '', reason: 'recognised request: ' + intent.name.slice(1)};
    }
  }
  return aiEnabled ? {path: 'local_ai', reason: 'open question for your local model'} : {path: 'local_reply', reason: 'no model enabled'};
}
module.exports = {route, INTENTS};
