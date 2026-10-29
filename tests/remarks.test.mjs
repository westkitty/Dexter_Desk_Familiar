import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemarks} from '../src/remarks.mjs';

test('authored repeated-action cadence is contextual but never persisted', () => {
  const remarks = createRemarks();
  assert.equal(remarks.choose('eating', 'Very well. One treat.', 100), 'Very well. One treat.');
  assert.equal(remarks.choose('eating', 'Very well. One treat.', 200), 'This is beginning to look like a negotiation.');
  assert.equal(remarks.choose('eating', 'Very well. One treat.', 300), 'Bribery. Continue.');
  assert.equal(remarks.choose('eating', 'Very well. One treat.', 400), 'Bribery. Continue.');
  assert.equal(remarks.choose('huffing', 'Hff. An official protest.', 500), 'Hff. An official protest.');
  assert.equal(remarks.choose('eating', 'Very well. One treat.', 501), 'Very well. One treat.');
  assert.equal(remarks.choose('eating', 'Very well. One treat.', 15001), 'Very well. One treat.');
  remarks.reset();
  assert.equal(remarks.choose('huffing', 'Hff. An official protest.', 15002), 'Hff. An official protest.');
});

test('unrecognized signals preserve explicit message and malformed clocks are ignored', () => {
  const remarks = createRemarks();
  assert.equal(remarks.choose('sleeping', 'Do not disturb', 1), 'Do not disturb');
  assert.equal(remarks.choose('eating', 'Safe fallback', Infinity), 'Safe fallback');
  assert.equal(remarks.choose('eating', 'Very well. One treat.', 5), 'Very well. One treat.');
  assert.equal(remarks.choose('eating', 'Very well. One treat.', 4), 'Very well. One treat.');
});

test('specific direct pet dialogue is not replaced by generic huff cadence', () => {
 const remarks = createRemarks();
 assert.equal(remarks.choose('huffing', 'This meeting was unnecessary.', 100), 'This meeting was unnecessary.');
 assert.equal(remarks.choose('huffing', 'Hff. An official protest.', 101), 'Hff. An official protest.');
});
