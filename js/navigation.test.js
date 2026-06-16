import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createState,
  clampPage,
  pairLeading,
  displaySlots,
  next,
  prev,
  goToPage,
  sliderMax,
  sliderValue,
  pageFromSlider,
  setSlider,
} from './navigation.js';

test('clampPage keeps in-range values', () => {
  assert.equal(clampPage(5, 10), 5);
});

test('clampPage clamps below 1 up to 1', () => {
  assert.equal(clampPage(0, 10), 1);
  assert.equal(clampPage(-3, 10), 1);
});

test('clampPage clamps above total down to total', () => {
  assert.equal(clampPage(99, 10), 10);
});

test('createState applies defaults', () => {
  const s = createState({ totalPages: 10 });
  assert.equal(s.page, 1);
  assert.equal(s.dir, 'rtl');
  assert.equal(s.spread, true);
  assert.equal(s.totalPages, 10);
});

test('createState clamps the initial page', () => {
  assert.equal(createState({ totalPages: 10, page: 999 }).page, 10);
  assert.equal(createState({ totalPages: 10, page: 0 }).page, 1);
});

test('createState falls back to rtl on unknown dir', () => {
  assert.equal(createState({ totalPages: 10, dir: 'sideways' }).dir, 'rtl');
  assert.equal(createState({ totalPages: 10, dir: 'ltr' }).dir, 'ltr');
});

test('createState coerces spread to a boolean', () => {
  assert.equal(createState({ totalPages: 10, spread: false }).spread, false);
});

test('pairLeading returns the leading odd page of a pair', () => {
  assert.equal(pairLeading(1), 1);
  assert.equal(pairLeading(2), 1);
  assert.equal(pairLeading(3), 3);
  assert.equal(pairLeading(4), 3);
  assert.equal(pairLeading(10), 9);
});

test('displaySlots single mode returns the one page', () => {
  const s = createState({ totalPages: 10, page: 7, spread: false });
  assert.deepEqual(displaySlots(s), [7]);
});

test('displaySlots spread ltr puts odd left, even right', () => {
  const s = createState({ totalPages: 10, page: 3, dir: 'ltr' });
  assert.deepEqual(displaySlots(s), [3, 4]);
});

test('displaySlots spread ltr resolves any page in the pair', () => {
  const s = createState({ totalPages: 10, page: 10, dir: 'ltr' });
  assert.deepEqual(displaySlots(s), [9, 10]);
});

test('displaySlots spread rtl puts even left, odd right', () => {
  const s = createState({ totalPages: 10, page: 3, dir: 'rtl' });
  assert.deepEqual(displaySlots(s), [4, 3]);
});

test('displaySlots spread ltr trailing odd page renders left only', () => {
  const s = createState({ totalPages: 5, page: 5, dir: 'ltr' });
  assert.deepEqual(displaySlots(s), [5, null]);
});

test('displaySlots spread rtl trailing odd page renders right only', () => {
  const s = createState({ totalPages: 5, page: 5, dir: 'rtl' });
  assert.deepEqual(displaySlots(s), [null, 5]);
});

test('displaySlots spread with a single-page document', () => {
  assert.deepEqual(displaySlots(createState({ totalPages: 1, dir: 'ltr' })), [1, null]);
  assert.deepEqual(displaySlots(createState({ totalPages: 1, dir: 'rtl' })), [null, 1]);
});

test('next in spread mode advances by a pair', () => {
  const s = createState({ totalPages: 10, page: 1 });
  assert.equal(next(s).page, 3);
});

test('next in spread mode normalizes to the leading page', () => {
  const s = createState({ totalPages: 10, page: 2 });
  assert.equal(next(s).page, 3);
});

test('next in spread mode stays put on the last pair', () => {
  const s = createState({ totalPages: 10, page: 9 });
  assert.equal(next(s).page, 9);
});

test('prev in spread mode goes back a pair', () => {
  const s = createState({ totalPages: 10, page: 4 });
  assert.equal(prev(s).page, 1);
});

test('prev in spread mode stays put on the first pair', () => {
  const s = createState({ totalPages: 10, page: 2 });
  assert.equal(prev(s).page, 1);
});

test('next/prev in single mode steps by one page', () => {
  const s = createState({ totalPages: 10, page: 5, spread: false });
  assert.equal(next(s).page, 6);
  assert.equal(prev(s).page, 4);
});

test('next/prev in single mode clamps at the ends', () => {
  assert.equal(next(createState({ totalPages: 10, page: 10, spread: false })).page, 10);
  assert.equal(prev(createState({ totalPages: 10, page: 1, spread: false })).page, 1);
});

test('goToPage clamps the target', () => {
  const s = createState({ totalPages: 10, page: 1 });
  assert.equal(goToPage(s, 7).page, 7);
  assert.equal(goToPage(s, 99).page, 10);
  assert.equal(goToPage(s, 0).page, 1);
});

test('slider max is one step per pair in spread mode', () => {
  assert.equal(sliderMax(createState({ totalPages: 10, page: 1 })), 5);
  // a trailing odd page counts as its own pair
  assert.equal(sliderMax(createState({ totalPages: 5, page: 1 })), 3);
});

test('slider spread maps pairs forward regardless of binding direction', () => {
  for (const dir of ['ltr', 'rtl']) {
    const s = createState({ totalPages: 10, page: 1, dir });
    assert.equal(sliderValue(s), 1);
    assert.equal(sliderValue(goToPage(s, 3)), 2);
    assert.equal(sliderValue(goToPage(s, 10)), 5);
    assert.equal(pageFromSlider(s, 3), 5);
    assert.equal(setSlider(s, 3).page, 5);
  }
});

test('slider spread counts a trailing odd page as its own pair', () => {
  const s = createState({ totalPages: 5, page: 1 });
  assert.equal(sliderValue(goToPage(s, 5)), 3);
});

test('setSlider clamps the slider value', () => {
  const s = createState({ totalPages: 10, page: 1 });
  assert.equal(setSlider(s, 99).page, 9);
  assert.equal(setSlider(s, 0).page, 1);
});

test('slider single mode is one step per page', () => {
  const s = createState({ totalPages: 10, page: 4, spread: false });
  assert.equal(sliderMax(s), 10);
  assert.equal(sliderValue(s), 4);
  assert.equal(pageFromSlider(s, 7), 7);
  assert.equal(setSlider(s, 7).page, 7);
});