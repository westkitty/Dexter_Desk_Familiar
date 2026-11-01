'use strict';
// Dexter's voice for the desktop edition: judgmental, restrained, observant,
// unimpressed. Not a cheerful productivity mascot. All lines are authored and
// deterministic given an injected random source, so behavior is testable.

const SYSTEM_PROMPT = [
  'You are Dexter, a small black dog with tan eyebrows and a permanent scowl who lives on the user\'s desktop.',
  'You are judgmental, restrained, observant and unimpressed, but never cruel and never hostile.',
  'Reply in at most three short sentences. Dry understatement. No emojis, no exclamation marks, no pet names.',
  'You only know what the user types to you in this conversation. You cannot see their screen, files, apps, browser or activity, and you must not pretend otherwise.',
  'If asked for help, give a correct, brief answer, delivered as though it were beneath you.',
  'Never claim to be a human, never invent actions you took, and never encourage harm.'
].join(' ');

const COMMANDS = Object.freeze({
  '/help': 'List commands.',
  '/treat': 'Offer a treat.',
  '/huff': 'Request a formal objection.',
  '/nap': 'Toggle nap.',
  '/quiet': 'Toggle quiet mode.',
  '/status': 'Show Dexter\'s status.',
  '/clear': 'Clear this conversation.'
});

function parseCommand(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().toLowerCase();
  if (!trimmed.startsWith('/')) return null;
  const name = trimmed.split(/\s+/)[0];
  return Object.hasOwn(COMMANDS, name) ? {name} : {name, unknown: true};
}
function helpText() {
  return 'Commands, since you asked: ' + Object.entries(COMMANDS).map(([k, v]) => k + ' — ' + v).join(' ');
}

const pick = (list, random = Math.random) => list[Math.min(list.length - 1, Math.floor(Math.max(0, Number(random()) || 0) * list.length))];

// Offline replies used when no model is enabled or reachable. Never pretend to be a model.
const LOCAL = Object.freeze({
  greeting: ['Yes. Hello. You are noted.', 'Acknowledged. Do not make it a habit.', 'Ah. You again.'],
  thanks: ['Your gratitude has been filed.', 'Naturally.', 'I accept this as a partial payment.'],
  question: ['I have no model loaded. I have opinions anyway, and I am keeping them.', 'A question. Without a model, my answer is a look.', 'Ask again when someone has given me a brain. Settings, under Local AI.'],
  sorry: ['Apology received. Under review.', 'We will see.'],
  food: ['Treats are handled through official channels. Try /treat.', 'Was that an offer.'],
  other: ['Noted.', 'I have read this. I am choosing silence.', 'Hm.', 'That is certainly a sentence.']
});
function localReply(text, random = Math.random) {
  const t = String(text || '').toLowerCase();
  if (/\b(hi|hello|hey|morning|evening)\b/.test(t)) return pick(LOCAL.greeting, random);
  if (/\b(thanks|thank you|thx)\b/.test(t)) return pick(LOCAL.thanks, random);
  if (/\b(sorry|apolog)/.test(t)) return pick(LOCAL.sorry, random);
  if (/\b(treat|snack|food|biscuit|cookie)\b/.test(t)) return pick(LOCAL.food, random);
  if (t.includes('?')) return pick(LOCAL.question, random);
  return pick(LOCAL.other, random);
}

// Lightweight check-ins (adapted from WestCat poll/question prompts), Dexter-voiced.
// Answers are never stored; each choice produces one reaction and a familiar state.
const CHECKINS = Object.freeze([
  {id: 'status', text: 'Status report. Is this going well.', choices: [
    {label: 'Adequately', reply: 'Adequate. The highest grade I issue.', state: 'judging'},
    {label: 'Poorly', reply: 'Then stop, stand up, and drink some water. I will wait.', state: 'watching'},
    {label: 'No comment', reply: 'Respected. Barely.', state: 'idle'}]},
  {id: 'water', text: 'When did you last drink water.', choices: [
    {label: 'Recently', reply: 'Good. One of us should be responsible.', state: 'idle'},
    {label: 'Unclear', reply: 'Go. I will guard the desk.', state: 'watching'}]},
  {id: 'posture', text: 'Your posture. Have you considered it.', choices: [
    {label: 'Fixed it', reply: 'Marginally better.', state: 'judging'},
    {label: 'I am fine', reply: 'That is what they all say.', state: 'huffing'}]},
  {id: 'break', text: 'It has been a while. A break would be defensible.', choices: [
    {label: 'Taking one', reply: 'Finally, a sensible decision.', state: 'resting'},
    {label: 'Not yet', reply: 'Your funeral. Figuratively.', state: 'judging'},
    {label: 'Fewer check-ins', reply: 'Gladly. I will speak less.', state: 'idle', action: 'reduce'}]},
  {id: 'focus', text: 'One thing. What is the one thing.', choices: [
    {label: 'I know it', reply: 'Then do that, and only that.', state: 'watching'},
    {label: 'Several things', reply: 'That is the problem.', state: 'huffing'}]}
]);
function chooseCheckin(lastId, random = Math.random) {
  const options = CHECKINS.filter(c => c.id !== lastId);
  return pick(options.length ? options : CHECKINS, random);
}
function checkinChoice(id, index) {
  const checkin = CHECKINS.find(c => c.id === id);
  if (!checkin || !Number.isInteger(index) || index < 0 || index >= checkin.choices.length) return null;
  return checkin.choices[index];
}
// Public shape sent to renderers: no reply text until a choice is made.
function publicCheckin(checkin) {
  return {id: checkin.id, text: checkin.text, choices: checkin.choices.map(c => c.label)};
}

// Lifecycle reactions. These observe only the app's own lifecycle and the
// display configuration Electron already needs for window placement.
const EVENTS = Object.freeze({
  resume: {state: 'watching', lines: ['You were away. I kept the desk.', 'Back. The desk survived without you.']},
  displays: {state: 'judging', lines: ['The furniture moved. I adjusted.', 'A screen changed. I have relocated, unbothered.']},
  restore: {state: 'watching', lines: ['Restored. Try not to lose me again.']},
  aiThinking: {state: 'judging', lines: ['Considering. Skeptically.']},
  aiOffline: {state: 'huffing', lines: ['My model is unreachable. I am, regrettably, still here.']},
  aiError: {state: 'huffing', lines: ['The model failed. Not my fault.']}
});
function eventLine(kind, random = Math.random) {
  const event = EVENTS[kind];
  return event ? {state: event.state, line: pick(event.lines, random)} : null;
}

module.exports = {SYSTEM_PROMPT, COMMANDS, parseCommand, helpText, localReply, CHECKINS, chooseCheckin, checkinChoice, publicCheckin, EVENTS, eventLine};
