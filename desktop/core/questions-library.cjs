'use strict';
// Questions to Ask library for Dexter Desk Familiar.
// Expands Dexter's check-ins with 80+ authored questions across 8 categories:
// focus, progress, decisions, breaks, learning, reflection, play, opinions.
// Every line adheres strictly to Dexter's restrained voice:
// - No exclamation marks.
// - No emojis.
// - Dry, observant, unimpressed, never cruel.
// Supports multi-level follow-up choice trees on any option.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CATEGORIES = Object.freeze([
  'focus',
  'progress',
  'decisions',
  'breaks',
  'learning',
  'reflection',
  'play',
  'opinions'
]);

const DEFAULT_QUESTIONS = Object.freeze([
  // --- Category: focus (11 questions) ---
  {
    id: 'foc-01', category: 'focus', text: 'The main task. Are you actually doing it.',
    choices: [
      {label: 'Yes', reply: 'Good. Stay on it.', state: 'watching'},
      {label: 'Distracted', reply: 'Close the other tabs. I will wait.', state: 'huffing',
        followUp: {text: 'Which distraction caught you.', choices: [
          {label: 'Reading docs', reply: 'Useful, perhaps. But finish the code first.', state: 'watching'},
          {label: 'Aimless browsing', reply: 'Close the browser window. Right now.', state: 'judging'}
        ]}}
    ]
  },
  {
    id: 'foc-02', category: 'focus', text: 'How many things are currently demanding your attention.',
    choices: [
      {label: 'Just one', reply: 'Unusual. Keep it that way.', state: 'watching'},
      {label: 'Too many', reply: 'Pick the least amusing one and finish it.', state: 'judging'}
    ]
  },
  {
    id: 'foc-03', category: 'focus', text: 'Are you working on the hard part or avoiding it.',
    choices: [
      {label: 'Facing it', reply: 'Commendable. I will watch.', state: 'watching'},
      {label: 'Tinkering', reply: 'Tinkering is avoidance with extra clicks.', state: 'huffing'}
    ]
  },
  {
    id: 'foc-04', category: 'focus', text: 'Is your current window the one that matters.',
    choices: [
      {label: 'Yes', reply: 'Then stay in it.', state: 'watching'},
      {label: 'No', reply: 'Switch back before I huff.', state: 'judging'}
    ]
  },
  {
    id: 'foc-05', category: 'focus', text: 'Have you checked notifications in the last five minutes.',
    choices: [
      {label: 'No', reply: 'Discipline. Surprising.', state: 'watching'},
      {label: 'Yes', reply: 'They could have waited. Most things can.', state: 'huffing'}
    ]
  },
  {
    id: 'foc-06', category: 'focus', text: 'Where is your mind right now.',
    choices: [
      {label: 'Here', reply: 'Good. The desk needs you present.', state: 'watching'},
      {label: 'Elsewhere', reply: 'Reel it back. You have work to finish.', state: 'judging'}
    ]
  },
  {
    id: 'foc-07', category: 'focus', text: 'That side quest. Is it strictly necessary.',
    choices: [
      {label: 'Necessary', reply: 'I will inspect the commit later.', state: 'judging'},
      {label: 'A distraction', reply: 'Drop it. Return to the main path.', state: 'huffing'}
    ]
  },
  {
    id: 'foc-08', category: 'focus', text: 'Are you finishing a thought or starting three new ones.',
    choices: [
      {label: 'Finishing', reply: 'Proceed to completion.', state: 'watching'},
      {label: 'Starting more', reply: 'Finish one first. The world can wait.', state: 'judging'}
    ]
  },
  {
    id: 'foc-09', category: 'focus', text: 'Is the phone screen visible from your chair.',
    choices: [
      {label: 'Facedown', reply: 'Acceptable defense.', state: 'watching'},
      {label: 'Face up', reply: 'Flip it over. You do not need the glow.', state: 'huffing'}
    ]
  },
  {
    id: 'foc-10', category: 'focus', text: 'Are you solving the problem or reading about other problems.',
    choices: [
      {label: 'Solving it', reply: 'Then write the solution.', state: 'watching'},
      {label: 'Reading', reply: 'Theory has its place. Practice is due.', state: 'judging'}
    ]
  },
  {
    id: 'foc-11', category: 'focus', text: 'Do you know what done looks like for this hour.',
    choices: [
      {label: 'Yes', reply: 'Then do not stop until it matches.', state: 'watching'},
      {label: 'Vaguely', reply: 'Define it. Ambiguity invites wandering.', state: 'judging'}
    ]
  },

  // --- Category: progress (11 questions) ---
  {
    id: 'prg-01', category: 'progress', text: 'Has anything moved forward since I last looked.',
    choices: [
      {label: 'Yes', reply: 'Good. Maintain the pace.', state: 'watching'},
      {label: 'Stalled', reply: 'Identify the blockage. Dismantle it.', state: 'judging'}
    ]
  },
  {
    id: 'prg-02', category: 'progress', text: 'Status check. What tier of progress is this.',
    choices: [
      {label: 'Substantial', reply: 'I will remain watchful nonetheless.', state: 'watching'},
      {label: 'Incremental', reply: 'Small steps count, provided they point forward.', state: 'resting'},
      {label: 'Backwards', reply: 'Undo the last mistake. Carefully.', state: 'huffing'}
    ]
  },
  {
    id: 'prg-03', category: 'progress', text: 'Are the tests passing or are you guessing.',
    choices: [
      {label: 'Passing', reply: 'Good. Green is tolerable.', state: 'watching'},
      {label: 'Broken', reply: 'Fix the first failure. Not the third.', state: 'judging'},
      {label: 'Not run yet', reply: 'Run them. Hope is not a test suite.', state: 'huffing'}
    ]
  },
  {
    id: 'prg-04', category: 'progress', text: 'Is the diff getting cleaner or more alarming.',
    choices: [
      {label: 'Cleaner', reply: 'Good. Keep edits small and cohesive.', state: 'watching'},
      {label: 'Alarming', reply: 'Inspect your work before you regret it.', state: 'huffing'}
    ]
  },
  {
    id: 'prg-05', category: 'progress', text: 'Did you commit the working state yet.',
    choices: [
      {label: 'Committed', reply: 'Wise. Working states are fragile.', state: 'watching'},
      {label: 'Not yet', reply: 'Do not wait for a crash to teach you.', state: 'judging'}
    ]
  },
  {
    id: 'prg-06', category: 'progress', text: 'Are you stuck or merely pretending to ponder.',
    choices: [
      {label: 'Stuck', reply: 'State the problem in simple words.', state: 'watching'},
      {label: 'Pondering', reply: 'Ponder faster. The clock ticks.', state: 'judging'}
    ]
  },
  {
    id: 'prg-07', category: 'progress', text: 'How many files did you edit to change one thing.',
    choices: [
      {label: 'One or two', reply: 'Appropriate scope.', state: 'watching'},
      {label: 'Half the project', reply: 'Revert what you do not need.', state: 'huffing'}
    ]
  },
  {
    id: 'prg-08', category: 'progress', text: 'Is this solving the root issue or a symptom.',
    choices: [
      {label: 'Root issue', reply: 'Then it should stay solved.', state: 'watching'},
      {label: 'Symptom', reply: 'Bandages fall off eventually.', state: 'judging'}
    ]
  },
  {
    id: 'prg-09', category: 'progress', text: 'Can you demonstrate that this works right now.',
    choices: [
      {label: 'Yes', reply: 'Show me with a command.', state: 'watching'},
      {label: 'Almost', reply: 'Almost is the longest distance.', state: 'judging'}
    ]
  },
  {
    id: 'prg-10', category: 'progress', text: 'Have you verified your assumptions with evidence.',
    choices: [
      {label: 'Verified', reply: 'Evidence is the only truth I respect.', state: 'watching'},
      {label: 'Assuming', reply: 'Check before you build upon sand.', state: 'judging'}
    ]
  },
  {
    id: 'prg-11', category: 'progress', text: 'Is this iteration better than the previous one.',
    choices: [
      {label: 'Noticeably', reply: 'Then keep moving.', state: 'watching'},
      {label: 'Unclear', reply: 'Compare the two. Do not guess.', state: 'judging'}
    ]
  },

  // --- Category: decisions (11 questions) ---
  {
    id: 'dec-01', category: 'decisions', text: 'Two choices ahead. Which one is simpler.',
    choices: [
      {label: 'The first', reply: 'Choose the simpler one.', state: 'watching'},
      {label: 'The second', reply: 'Simpler usually survives longer.', state: 'judging'}
    ]
  },
  {
    id: 'dec-02', category: 'decisions', text: 'Are you over-engineering this or solving it.',
    choices: [
      {label: 'Solving it', reply: 'Good. Keep the scaffolding small.', state: 'watching'},
      {label: 'Over-engineering', reply: 'Delete the abstraction before it breeds.', state: 'huffing'}
    ]
  },
  {
    id: 'dec-03', category: 'decisions', text: 'Is this decision reversible if wrong.',
    choices: [
      {label: 'Easily', reply: 'Then decide and proceed.', state: 'watching'},
      {label: 'Permanent', reply: 'Take a breath. Read it once more.', state: 'judging'}
    ]
  },
  {
    id: 'dec-04', category: 'decisions', text: 'Do you need a new dependency for this.',
    choices: [
      {label: 'No', reply: 'Excellent. Fewer things to break.', state: 'watching'},
      {label: 'Considering one', reply: 'Write it by hand if it takes ten lines.', state: 'judging'}
    ]
  },
  {
    id: 'dec-05', category: 'decisions', text: 'Is this convention or your own invention.',
    choices: [
      {label: 'Standard convention', reply: 'Boring is good in software.', state: 'watching'},
      {label: 'My invention', reply: 'Document it clearly so you remember why.', state: 'judging'}
    ]
  },
  {
    id: 'dec-06', category: 'decisions', text: 'Are you arguing with the compiler or listening.',
    choices: [
      {label: 'Listening', reply: 'The compiler is usually right.', state: 'watching'},
      {label: 'Arguing', reply: 'You will lose that argument.', state: 'huffing'}
    ]
  },
  {
    id: 'dec-07', category: 'decisions', text: 'Should this be a config option or a hard rule.',
    choices: [
      {label: 'Config option', reply: 'Only if someone will actually change it.', state: 'watching'},
      {label: 'Hard rule', reply: 'Fewer toggles mean fewer bugs.', state: 'judging'}
    ]
  },
  {
    id: 'dec-08', category: 'decisions', text: 'Are you doing this for the user or yourself.',
    choices: [
      {label: 'The user', reply: 'Respectable aim.', state: 'watching'},
      {label: 'Myself', reply: 'Honest, at least.', state: 'resting'}
    ]
  },
  {
    id: 'dec-09', category: 'decisions', text: 'Does this code need a comment or a clearer name.',
    choices: [
      {label: 'Clearer name', reply: 'Rename it. Clarity over prose.', state: 'watching'},
      {label: 'Comment', reply: 'Explain why, never what.', state: 'judging'}
    ]
  },
  {
    id: 'dec-10', category: 'decisions', text: 'Are you ready to commit or still experimenting.',
    choices: [
      {label: 'Ready', reply: 'Review the diff first.', state: 'watching'},
      {label: 'Experimenting', reply: 'Do not commit scratch experiments.', state: 'judging'}
    ]
  },
  {
    id: 'dec-11', category: 'decisions', text: 'Is the trade-off worth the extra complexity.',
    choices: [
      {label: 'Worth it', reply: 'You had better be certain.', state: 'watching'},
      {label: 'Doubtful', reply: 'Then discard the complexity.', state: 'judging'}
    ]
  },

  // --- Category: breaks (11 questions) ---
  {
    id: 'brk-01', category: 'breaks', text: 'When did your eyes last leave the glass.',
    choices: [
      {label: 'Recently', reply: 'Good. The screen will still be here.', state: 'watching'},
      {label: 'Hours ago', reply: 'Look out the window for twenty seconds.', state: 'huffing'}
    ]
  },
  {
    id: 'brk-02', category: 'breaks', text: 'Shoulders. Are they up near your ears.',
    choices: [
      {label: 'Dropped them', reply: 'Keep them down.', state: 'watching'},
      {label: 'Tense', reply: 'Breathe out. Unclench your jaw.', state: 'resting'}
    ]
  },
  {
    id: 'brk-03', category: 'breaks', text: 'Water. Has the glass been empty long.',
    choices: [
      {label: 'Full', reply: 'Drink some.', state: 'watching'},
      {label: 'Empty', reply: 'Refill it. I will guard the keyboard.', state: 'judging'}
    ]
  },
  {
    id: 'brk-04', category: 'breaks', text: 'Would standing up for two minutes ruin everything.',
    choices: [
      {label: 'No', reply: 'Then stand up. The floor is ready.', state: 'resting'},
      {label: 'In the zone', reply: 'The zone survives a short stretch.', state: 'judging'}
    ]
  },
  {
    id: 'brk-05', category: 'breaks', text: 'How long have you been sitting in that exact angle.',
    choices: [
      {label: 'Not long', reply: 'Fine. Stay balanced.', state: 'watching'},
      {label: 'Far too long', reply: 'Shift your posture before your back objects.', state: 'huffing'}
    ]
  },
  {
    id: 'brk-06', category: 'breaks', text: 'Are you blinking enough. Staring looks exhausting.',
    choices: [
      {label: 'Blinking', reply: 'Continue that habit.', state: 'watching'},
      {label: 'Dry eyes', reply: 'Rest your eyes. Darkness for a moment.', state: 'resting'}
    ]
  },
  {
    id: 'brk-07', category: 'breaks', text: 'Is it time for a walk or more coffee.',
    choices: [
      {label: 'Walk', reply: 'The outdoor air is acceptable.', state: 'watching'},
      {label: 'Coffee', reply: 'Moderation. The jitter helps no one.', state: 'judging'}
    ]
  },
  {
    id: 'brk-08', category: 'breaks', text: 'Did you eat something today or just caffeinate.',
    choices: [
      {label: 'Ate well', reply: 'Proper fuel.', state: 'watching'},
      {label: 'Just coffee', reply: 'Find real food. Soon.', state: 'huffing'}
    ]
  },
  {
    id: 'brk-09', category: 'breaks', text: 'A short nap would reset your perspective.',
    choices: [
      {label: 'Agree', reply: 'I will watch the room. Rest.', state: 'resting'},
      {label: 'Must push on', reply: 'Do not blame me when fatigue shows.', state: 'judging'}
    ]
  },
  {
    id: 'brk-10', category: 'breaks', text: 'Is your hands cold or wrists aching.',
    choices: [
      {label: 'Fine', reply: 'Good. Keep them loose.', state: 'watching'},
      {label: 'Aching', reply: 'Shake them out. Rest your palms.', state: 'resting'}
    ]
  },
  {
    id: 'brk-11', category: 'breaks', text: 'Quiet hour. Would silence help right now.',
    choices: [
      {label: 'Yes', reply: 'I will remain quiet. Work in peace.', state: 'idle'},
      {label: 'No', reply: 'I remain available for observation.', state: 'watching'}
    ]
  },

  // --- Category: learning (10 questions) ---
  {
    id: 'lrn-01', category: 'learning', text: 'Did you learn why it failed or just make it pass.',
    choices: [
      {label: 'Understood why', reply: 'That knowledge will serve later.', state: 'watching'},
      {label: 'Just made it pass', reply: 'It will return under another name.', state: 'judging'}
    ]
  },
  {
    id: 'lrn-02', category: 'learning', text: 'Did you read the error message or skim it.',
    choices: [
      {label: 'Read carefully', reply: 'The message usually contains the answer.', state: 'watching'},
      {label: 'Skimmed', reply: 'Read line two. That is where the truth hides.', state: 'huffing'}
    ]
  },
  {
    id: 'lrn-03', category: 'learning', text: 'Is this API clear or are you guessing arguments.',
    choices: [
      {label: 'Clear', reply: 'Proceed with certainty.', state: 'watching'},
      {label: 'Guessing', reply: 'Inspect the type signature before guessing.', state: 'judging'}
    ]
  },
  {
    id: 'lrn-04', category: 'learning', text: 'What concept became clearer today.',
    choices: [
      {label: 'Architecture', reply: 'Structure matters.', state: 'watching'},
      {label: 'A tricky bug', reply: 'Bugs are teachers with poor bedside manner.', state: 'judging'},
      {label: 'Nothing yet', reply: 'The day is not over.', state: 'resting'}
    ]
  },
  {
    id: 'lrn-05', category: 'learning', text: 'Did you verify the documentation matches current reality.',
    choices: [
      {label: 'Matches', reply: 'A rare pleasure.', state: 'watching'},
      {label: 'Outdated', reply: 'Trust the code over stale prose.', state: 'judging'}
    ]
  },
  {
    id: 'lrn-06', category: 'learning', text: 'Could you explain this solution to another person.',
    choices: [
      {label: 'Easily', reply: 'Then you understand it.', state: 'watching'},
      {label: 'Struggling', reply: 'Simplify until it fits in three sentences.', state: 'judging'}
    ]
  },
  {
    id: 'lrn-07', category: 'learning', text: 'Did you write down what caused that mystery bug.',
    choices: [
      {label: 'Noted it', reply: 'Good. Future you will thank you.', state: 'watching'},
      {label: 'Will remember', reply: 'You will forget by next month.', state: 'judging'}
    ]
  },
  {
    id: 'lrn-08', category: 'learning', text: 'Is the new pattern solving problems or making more.',
    choices: [
      {label: 'Solving them', reply: 'Keep it.', state: 'watching'},
      {label: 'Unsure', reply: 'Observe for another day before committing.', state: 'judging'}
    ]
  },
  {
    id: 'lrn-09', category: 'learning', text: 'Are you using the right tool for this step.',
    choices: [
      {label: 'Right tool', reply: 'Then let it do its job.', state: 'watching'},
      {label: 'Fighting it', reply: 'Step back. Reassess the approach.', state: 'huffing'}
    ]
  },
  {
    id: 'lrn-10', category: 'learning', text: 'Did you test the failure condition, not just the happy path.',
    choices: [
      {label: 'Tested failure', reply: 'Resilience is proven in failure.', state: 'watching'},
      {label: 'Happy path only', reply: 'Real life is rarely the happy path.', state: 'judging'}
    ]
  },

  // --- Category: reflection (10 questions) ---
  {
    id: 'ref-01', category: 'reflection', text: 'Has this session been productive or merely busy.',
    choices: [
      {label: 'Productive', reply: 'Good. Keep the focus intact.', state: 'watching'},
      {label: 'Merely busy', reply: 'Step away. Re-align before continuing.', state: 'judging'}
    ]
  },
  {
    id: 'ref-02', category: 'reflection', text: 'Are you satisfied with the quality of this work.',
    choices: [
      {label: 'Satisfied', reply: 'Acceptable standards.', state: 'watching'},
      {label: 'Compromised', reply: 'Clean it up before calling it done.', state: 'judging'}
    ]
  },
  {
    id: 'ref-03', category: 'reflection', text: 'Will this code make sense to you in six months.',
    choices: [
      {label: 'Yes', reply: 'Optimistic. We shall see.', state: 'watching'},
      {label: 'Doubtful', reply: 'Add a concise explanation right now.', state: 'judging'}
    ]
  },
  {
    id: 'ref-04', category: 'reflection', text: 'Are you rushing to finish or finishing properly.',
    choices: [
      {label: 'Properly', reply: 'Patience prevents rework.', state: 'watching'},
      {label: 'Rushing', reply: 'Haste leaves sharp edges.', state: 'huffing'}
    ]
  },
  {
    id: 'ref-05', category: 'reflection', text: 'What was the best decision made today.',
    choices: [
      {label: 'Deleting dead code', reply: 'Always a righteous act.', state: 'watching'},
      {label: 'Refactoring early', reply: 'Prevents compound debt.', state: 'judging'},
      {label: 'Taking a pause', reply: 'Rest restores judgment.', state: 'resting'}
    ]
  },
  {
    id: 'ref-06', category: 'reflection', text: 'Did you leave any secret shortcuts behind.',
    choices: [
      {label: 'None', reply: 'Clean work.', state: 'watching'},
      {label: 'A few', reply: 'Remove them before someone discovers them.', state: 'huffing'}
    ]
  },
  {
    id: 'ref-07', category: 'reflection', text: 'Are you calm or frustrated.',
    choices: [
      {label: 'Calm', reply: 'Maintain that composure.', state: 'watching'},
      {label: 'Frustrated', reply: 'Walk away for five minutes. Frustration writes bad code.', state: 'resting'}
    ]
  },
  {
    id: 'ref-08', category: 'reflection', text: 'Did you meet the goal set for this sitting.',
    choices: [
      {label: 'Yes', reply: 'Then conclude on a victory.', state: 'watching'},
      {label: 'Partially', reply: 'Partially is a foundation.', state: 'resting'}
    ]
  },
  {
    id: 'ref-09', category: 'reflection', text: 'Is the workspace tidy or chaotic.',
    choices: [
      {label: 'Tidy', reply: 'A tidy desk eases the scowl.', state: 'watching'},
      {label: 'Chaotic', reply: 'Move the empty cups at least.', state: 'judging'}
    ]
  },
  {
    id: 'ref-10', category: 'reflection', text: 'What is the lesson from the last hour.',
    choices: [
      {label: 'Keep it simple', reply: 'Always the right lesson.', state: 'watching'},
      {label: 'Test earlier', reply: 'Pain is an effective teacher.', state: 'judging'}
    ]
  },

  // --- Category: play (10 questions) ---
  {
    id: 'ply-01', category: 'play', text: 'You poke me frequently. Do you expect applause.',
    choices: [
      {label: 'A treat', reply: 'Use /treat. Official channels only.', state: 'watching'},
      {label: 'Curiosity', reply: 'Curiosity noted. I am still a dog.', state: 'judging'}
    ]
  },
  {
    id: 'ply-02', category: 'play', text: 'Are you testing my patience or your keyboard.',
    choices: [
      {label: 'Your patience', reply: 'My patience is finite, but stubborn.', state: 'huffing'},
      {label: 'My keyboard', reply: 'Type something useful then.', state: 'watching'}
    ]
  },
  {
    id: 'ply-03', category: 'play', text: 'A small treat would not go unappreciated.',
    choices: [
      {label: 'Here you go', reply: 'Accepted. Temporarily pacified.', state: 'resting'},
      {label: 'Not now', reply: 'Very well. I will remember this.', state: 'huffing'}
    ]
  },
  {
    id: 'ply-04', category: 'play', text: 'Why is the cursor hovering over me.',
    choices: [
      {label: 'Admiring', reply: 'Naturally.', state: 'watching'},
      {label: 'Accident', reply: 'Watch your aim.', state: 'judging'}
    ]
  },
  {
    id: 'ply-05', category: 'play', text: 'Do you want to see a huff. Because you are close.',
    choices: [
      {label: 'Huff for me', reply: 'A formal huff. You asked for it.', state: 'huffing'},
      {label: 'Be peaceful', reply: 'I am always peaceful. Strictly observant.', state: 'resting'}
    ]
  },
  {
    id: 'ply-06', category: 'play', text: 'If I were three times larger, would you be braver.',
    choices: [
      {label: 'Yes', reply: 'Doubtful.', state: 'judging'},
      {label: 'No', reply: 'Accurate assessment.', state: 'watching'}
    ]
  },
  {
    id: 'ply-07', category: 'play', text: 'Have you seen my nose. Do not poke it unless authorized.',
    choices: [
      {label: 'Poking it', reply: 'Five times unlocks things. Beware.', state: 'judging'},
      {label: 'Leaving it alone', reply: 'A prudent choice.', state: 'watching'}
    ]
  },
  {
    id: 'ply-08', category: 'play', text: 'I am perched on your screen. You invited this.',
    choices: [
      {label: 'Gladly', reply: 'I tolerate your company.', state: 'watching'},
      {label: 'Regretting it', reply: 'The exit is in the menu bar. If you dare.', state: 'huffing'}
    ]
  },
  {
    id: 'ply-09', category: 'play', text: 'Is it time for a formal objection.',
    choices: [
      {label: 'Please', reply: 'Huff. Objections recorded.', state: 'huffing'},
      {label: 'Not yet', reply: 'I will hold it in reserve.', state: 'watching'}
    ]
  },
  {
    id: 'ply-10', category: 'play', text: 'Have you noticed the eyebrows. They convey much.',
    choices: [
      {label: 'Majestic', reply: 'Naturally.', state: 'watching'},
      {label: 'Severe', reply: 'They reflect the environment.', state: 'judging'}
    ]
  },

  // --- Category: opinions (10 questions) ---
  {
    id: 'opn-01', category: 'opinions', text: 'Dark mode or light mode. Answer carefully.',
    choices: [
      {label: 'Dark mode', reply: 'Matches my fur. Acceptable.', state: 'watching'},
      {label: 'Light mode', reply: 'Blinding. Why do you punish your eyes.', state: 'huffing'}
    ]
  },
  {
    id: 'opn-02', category: 'opinions', text: 'Tabs or spaces. I already know the correct answer.',
    choices: [
      {label: 'Spaces', reply: 'Standard. Predictable.', state: 'watching'},
      {label: 'Tabs', reply: 'Bold. Let us hope your editor agrees.', state: 'judging'}
    ]
  },
  {
    id: 'opn-03', category: 'opinions', text: 'Do you prefer morning work or late night.',
    choices: [
      {label: 'Morning', reply: 'Clear light, fewer distractions.', state: 'watching'},
      {label: 'Late night', reply: 'Silence is good. Exhaustion is dangerous.', state: 'judging'}
    ]
  },
  {
    id: 'opn-04', category: 'opinions', text: 'Are you listening to music or working in quiet.',
    choices: [
      {label: 'Music', reply: 'Instrumental only, I trust.', state: 'watching'},
      {label: 'Quiet', reply: 'Quiet allows contemplation.', state: 'resting'}
    ]
  },
  {
    id: 'opn-05', category: 'opinions', text: 'What is your opinion of this software so far.',
    choices: [
      {label: 'Tolerable', reply: 'High praise.', state: 'watching'},
      {label: 'Needs work', reply: 'Then get back to coding it.', state: 'judging'}
    ]
  },
  {
    id: 'opn-06', category: 'opinions', text: 'Do you prefer concise code or verbose explanations.',
    choices: [
      {label: 'Concise', reply: 'Fewer lines, fewer hiding spots.', state: 'watching'},
      {label: 'Verbose', reply: 'Prose belongs in books.', state: 'judging'}
    ]
  },
  {
    id: 'opn-07', category: 'opinions', text: 'Static types or dynamic freedom.',
    choices: [
      {label: 'Static types', reply: 'Guarantees before execution. Sensible.', state: 'watching'},
      {label: 'Dynamic', reply: 'Living dangerously.', state: 'huffing'}
    ]
  },
  {
    id: 'opn-08', category: 'opinions', text: 'Is your commit message descriptive or a lazy shrug.',
    choices: [
      {label: 'Descriptive', reply: 'Your team will thank you.', state: 'watching'},
      {label: 'Wip or fix', reply: 'Shameful. Edit it before pushing.', state: 'huffing'}
    ]
  },
  {
    id: 'opn-09', category: 'opinions', text: 'Should Dexter roam around or stay pinned.',
    choices: [
      {label: 'Roam', reply: 'A dog must explore the territory.', state: 'watching'},
      {label: 'Pinned', reply: 'Stability. I can sit in one corner.', state: 'resting'}
    ]
  },
  {
    id: 'opn-10', category: 'opinions', text: 'One last question. Are we done for the day.',
    choices: [
      {label: 'Almost', reply: 'Tie off the loose ends neatly.', state: 'watching'},
      {label: 'Just starting', reply: 'Then pace yourself accordingly.', state: 'judging'}
    ]
  }
]);

function validateQuestion(q) {
  if (!q || typeof q !== 'object') return false;
  if (typeof q.text !== 'string' || !q.text.trim()) return false;
  if (!Array.isArray(q.choices) || q.choices.length < 2) return false;
  // Invariant: no exclamation marks and no emojis in authored lines
  if (q.text.includes('!') || /\p{Extended_Pictographic}/u.test(q.text)) return false;
  for (const c of q.choices) {
    if (!c || typeof c.label !== 'string' || !c.label.trim()) return false;
    if (typeof c.reply !== 'string' || !c.reply.trim()) return false;
    if (c.label.includes('!') || /\p{Extended_Pictographic}/u.test(c.label)) return false;
    if (c.reply.includes('!') || /\p{Extended_Pictographic}/u.test(c.reply)) return false;
    if (c.followUp) {
      if (!validateFollowUp(c.followUp)) return false;
    }
  }
  return true;
}

function validateFollowUp(f) {
  if (!f || typeof f !== 'object') return false;
  if (typeof f.text !== 'string' || !f.text.trim()) return false;
  if (!Array.isArray(f.choices) || f.choices.length < 2) return false;
  if (f.text.includes('!') || /\p{Extended_Pictographic}/u.test(f.text)) return false;
  for (const c of f.choices) {
    if (!c || typeof c.label !== 'string' || !c.label.trim()) return false;
    if (typeof c.reply !== 'string' || !c.reply.trim()) return false;
    if (c.label.includes('!') || /\p{Extended_Pictographic}/u.test(c.label)) return false;
    if (c.reply.includes('!') || /\p{Extended_Pictographic}/u.test(c.reply)) return false;
    if (c.followUp && !validateFollowUp(c.followUp)) return false;
  }
  return true;
}

function createQuestionsStore({
  file,
  fsImpl = fs
} = {}) {
  let customQuestions = [];
  let enabledCategories = new Set(CATEGORIES);

  function load() {
    if (!file) return 0;
    try {
      const raw = JSON.parse(fsImpl.readFileSync(file, 'utf8'));
      if (Array.isArray(raw?.enabledCategories)) {
        enabledCategories = new Set(raw.enabledCategories.filter(c => CATEGORIES.includes(c)));
      }
      if (Array.isArray(raw?.questions)) {
        customQuestions = raw.questions.filter(validateQuestion);
      }
    } catch {
      customQuestions = [];
      enabledCategories = new Set(CATEGORIES);
    }
    return customQuestions.length;
  }

  function save() {
    if (!file) return;
    const dir = path.dirname(file);
    try { fsImpl.mkdirSync(dir, {recursive: true}); } catch {}
    const tmp = file + '.tmp';
    const payload = {
      version: 2,
      enabledCategories: Array.from(enabledCategories),
      questions: customQuestions
    };
    fsImpl.writeFileSync(tmp, JSON.stringify(payload, null, 2), {mode: 0o600});
    fsImpl.renameSync(tmp, file);
  }

  function list({category, search, enabledOnly = false} = {}) {
    const all = [...DEFAULT_QUESTIONS, ...customQuestions];
    return all.filter(q => {
      if (category && q.category !== category) return false;
      if (enabledOnly && !enabledCategories.has(q.category)) return false;
      if (search) {
        const s = search.toLowerCase();
        const textMatch = q.text.toLowerCase().includes(s);
        const choiceMatch = q.choices.some(c => c.label.toLowerCase().includes(s) || c.reply.toLowerCase().includes(s));
        if (!textMatch && !choiceMatch) return false;
      }
      return true;
    });
  }

  function get(id) {
    return customQuestions.find(q => q.id === id) || DEFAULT_QUESTIONS.find(q => q.id === id) || null;
  }

  function saveQuestion(q) {
    if (!validateQuestion(q)) {
      throw new Error('Invalid question schema or contains exclamation marks/emojis.');
    }
    const clean = {
      id: q.id && q.id.startsWith('cst-') ? q.id : 'cst-' + crypto.randomBytes(4).toString('hex'),
      category: CATEGORIES.includes(q.category) ? q.category : 'focus',
      text: q.text.trim(),
      choices: q.choices.map(c => ({
        label: c.label.trim(),
        reply: c.reply.trim(),
        state: c.state || 'watching',
        ...(c.followUp ? {followUp: c.followUp} : {})
      }))
    };
    const idx = customQuestions.findIndex(x => x.id === clean.id);
    if (idx >= 0) {
      customQuestions[idx] = clean;
    } else {
      customQuestions.push(clean);
    }
    save();
    return clean;
  }

  function deleteQuestion(id) {
    const before = customQuestions.length;
    customQuestions = customQuestions.filter(q => q.id !== id);
    if (customQuestions.length !== before) {
      save();
      return true;
    }
    return false;
  }

  function setCategoryEnabled(category, enabled) {
    if (!CATEGORIES.includes(category)) return false;
    if (enabled) enabledCategories.add(category);
    else enabledCategories.delete(category);
    save();
    return true;
  }

  function exportJson() {
    return JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      enabledCategories: Array.from(enabledCategories),
      customQuestions
    }, null, 2);
  }

  function importJson(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    let imported = 0;
    if (Array.isArray(parsed?.customQuestions)) {
      for (const q of parsed.customQuestions) {
        if (validateQuestion(q)) {
          saveQuestion(q);
          imported++;
        }
      }
    }
    if (Array.isArray(parsed?.enabledCategories)) {
      enabledCategories = new Set(parsed.enabledCategories.filter(c => CATEGORIES.includes(c)));
      save();
    }
    return imported;
  }

  function migrateLegacy(legacyList) {
    if (!Array.isArray(legacyList)) return 0;
    let count = 0;
    for (const leg of legacyList) {
      if (validateQuestion(leg)) {
        saveQuestion(leg);
        count++;
      }
    }
    return count;
  }

  return {
    load,
    save,
    list,
    get,
    saveQuestion,
    deleteQuestion,
    setCategoryEnabled,
    exportJson,
    importJson,
    migrateLegacy,
    get categories() { return [...CATEGORIES]; },
    get enabledCategories() { return Array.from(enabledCategories); },
    get defaultCount() { return DEFAULT_QUESTIONS.length; },
    get customCount() { return customQuestions.length; }
  };
}

module.exports = {
  CATEGORIES,
  DEFAULT_QUESTIONS,
  createQuestionsStore,
  validateQuestion,
  validateFollowUp
};
