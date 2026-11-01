'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  CATEGORIES,
  DEFAULT_QUESTIONS,
  createQuestionsStore,
  validateQuestion
} = require('../core/questions-library.cjs');
const checkins = require('../core/checkins.cjs');

test('questions: has at least 80 distinct questions across 8 categories', () => {
  assert.ok(DEFAULT_QUESTIONS.length >= 80, `Expected at least 80 questions, got ${DEFAULT_QUESTIONS.length}`);
  assert.equal(CATEGORIES.length, 8);

  const seenIds = new Set();
  const catCounts = {};
  for (const c of CATEGORIES) catCounts[c] = 0;

  for (const q of DEFAULT_QUESTIONS) {
    assert.ok(!seenIds.has(q.id), `Duplicate question id: ${q.id}`);
    seenIds.add(q.id);
    assert.ok(CATEGORIES.includes(q.category), `Unknown category: ${q.category}`);
    catCounts[q.category]++;
  }

  for (const [cat, count] of Object.entries(catCounts)) {
    assert.ok(count >= 10, `Category ${cat} has only ${count} questions (minimum 10 required)`);
  }
});

test('questions: voice restraint - zero exclamation marks or emojis in all authored lines', () => {
  function checkRestraint(text, context) {
    assert.doesNotMatch(text, /!/, `Found exclamation mark in [${context}]: "${text}"`);
    assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, `Found emoji in [${context}]: "${text}"`);
  }

  function checkChoices(choices, parentContext) {
    for (const c of choices) {
      checkRestraint(c.label, `${parentContext} > choice.label`);
      checkRestraint(c.reply, `${parentContext} > choice.reply`);
      if (c.followUp) {
        checkRestraint(c.followUp.text, `${parentContext} > followUp.text`);
        checkChoices(c.followUp.choices, `${parentContext} > followUp`);
      }
    }
  }

  for (const q of DEFAULT_QUESTIONS) {
    checkRestraint(q.text, `question ${q.id}`);
    checkChoices(q.choices, `question ${q.id}`);
  }
});

test('questions: validator rejects questions with exclamation marks or emojis', () => {
  const invalid1 = {
    category: 'focus',
    text: 'Do this now!',
    choices: [
      {label: 'Yes', reply: 'Good.', state: 'watching'},
      {label: 'No', reply: 'Bad.', state: 'judging'}
    ]
  };
  assert.equal(validateQuestion(invalid1), false);

  const invalid2 = {
    category: 'focus',
    text: 'Coffee time.',
    choices: [
      {label: 'Yes ☕', reply: 'Fine.', state: 'watching'},
      {label: 'No', reply: 'Okay.', state: 'judging'}
    ]
  };
  assert.equal(validateQuestion(invalid2), false);

  const valid = {
    category: 'focus',
    text: 'A clean question.',
    choices: [
      {label: 'Option one', reply: 'First reply.', state: 'watching'},
      {label: 'Option two', reply: 'Second reply.', state: 'judging'}
    ]
  };
  assert.equal(validateQuestion(valid), true);
});

test('questions: store supports add, edit, delete, category toggle, import and export', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dex-q-test-'));
  const storeFile = path.join(tmpDir, 'questions.json');

  try {
    const store = createQuestionsStore({file: storeFile});
    assert.equal(store.defaultCount, DEFAULT_QUESTIONS.length);
    assert.equal(store.customCount, 0);

    // Save custom question
    const created = store.saveQuestion({
      category: 'play',
      text: 'Custom query text.',
      choices: [
        {label: 'First choice', reply: 'First answer.', state: 'watching'},
        {label: 'Second choice', reply: 'Second answer.', state: 'judging'}
      ]
    });
    assert.ok(created.id.startsWith('cst-'));
    assert.equal(store.customCount, 1);

    // Search and list
    const found = store.list({search: 'Custom query'});
    assert.equal(found.length, 1);
    assert.equal(found[0].id, created.id);

    // Category toggle
    store.setCategoryEnabled('play', false);
    assert.ok(!store.enabledCategories.includes('play'));
    const active = store.list({enabledOnly: true});
    assert.ok(active.every(q => q.category !== 'play'));

    // Export and import
    const jsonStr = store.exportJson();
    assert.match(jsonStr, /Custom query text/);

    const store2 = createQuestionsStore({file: path.join(tmpDir, 'q2.json')});
    const imported = store2.importJson(jsonStr);
    assert.equal(imported, 1);
    assert.equal(store2.customCount, 1);

    // Delete
    store.deleteQuestion(created.id);
    assert.equal(store.customCount, 0);
  } finally {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  }
});

test('questions: multi-level follow-ups resolve through checkins module', () => {
  const complexCheckin = {
    id: 'deep-test',
    text: 'Root question.',
    choices: [
      {
        label: 'Level 1 Choice 0',
        reply: 'Level 1 Choice 0 Reply.',
        state: 'watching'
      },
      {
        label: 'Level 1 Choice 1',
        reply: 'Level 1 Choice 1 Reply.',
        state: 'huffing',
        followUp: {
          text: 'Level 2 Follow-up Question.',
          choices: [
            {
              label: 'Level 2 Choice 0',
              reply: 'Level 2 Choice 0 Reply.',
              state: 'judging',
              followUp: {
                text: 'Level 3 Follow-up Question.',
                choices: [
                  {
                    label: 'Level 3 Choice 0',
                    reply: 'Level 3 Choice 0 Reply.',
                    state: 'resting'
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  };

  // Depth 0: initial view
  const rootPub = checkins.publicView(complexCheckin, []);
  assert.equal(rootPub.text, 'Root question.');
  assert.deepEqual(rootPub.choices, ['Level 1 Choice 0', 'Level 1 Choice 1']);

  // Depth 1: resolve choice [0] (no follow-up)
  assert.equal(checkins.resolve(complexCheckin, [0]).label, 'Level 1 Choice 0');
  assert.equal(checkins.publicView(complexCheckin, [0]), null);

  // Depth 1: view follow-up for choice [1]
  const l2Pub = checkins.publicView(complexCheckin, [1]);
  assert.equal(l2Pub.text, 'Level 2 Follow-up Question.');
  assert.deepEqual(l2Pub.choices, ['Level 2 Choice 0']);

  // Depth 2: resolve choice [1, 0]
  const l2Choice = checkins.resolve(complexCheckin, [1, 0]);
  assert.equal(l2Choice.label, 'Level 2 Choice 0');

  // Depth 2: view follow-up for [1, 0]
  const l3Pub = checkins.publicView(complexCheckin, [1, 0]);
  assert.equal(l3Pub.text, 'Level 3 Follow-up Question.');
  assert.deepEqual(l3Pub.choices, ['Level 3 Choice 0']);

  // Depth 3: resolve [1, 0, 0]
  const l3Choice = checkins.resolve(complexCheckin, [1, 0, 0]);
  assert.equal(l3Choice.label, 'Level 3 Choice 0');
  assert.equal(checkins.publicView(complexCheckin, [1, 0, 0]), null);
});
