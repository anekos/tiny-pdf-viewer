// navigation.js — pure navigation logic (DOM- and PDF.js-independent).
//
// Owns the spread/binding rules from DESIGN.md §6:
//   - Pages pair fixed as 1-2 / 3-4 / 5-6 …  (no cover special-casing).
//   - The pair containing page N has leading page 2k+1 where k = floor((N-1)/2).
//   - ltr (left binding): left = odd 2k+1, right = even 2k+2.
//   - rtl (right binding): left = even 2k+2, right = odd 2k+1.
//
// State is a plain object treated as immutable; mutators return a new state.
//   { totalPages, page, dir: 'rtl'|'ltr', spread: boolean }
// `page` is always a valid 1-based page. In spread mode the navigation
// functions normalize it to the leading page of its pair.

const DIRECTIONS = ['rtl', 'ltr'];

export function clampPage(page, totalPages) {
  if (page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

export function createState({ totalPages, page = 1, dir = 'rtl', spread = true }) {
  const total = Math.max(1, Math.trunc(totalPages));
  return {
    totalPages: total,
    page: clampPage(Math.trunc(page), total),
    dir: DIRECTIONS.includes(dir) ? dir : 'rtl',
    spread: Boolean(spread),
  };
}

// Leading (odd) page of the pair that contains `page`.
export function pairLeading(page) {
  const k = Math.floor((page - 1) / 2);
  return 2 * k + 1;
}

// Pages to render, as left-to-right slots. `null` means an empty slot.
// Single mode: [page]. Spread mode: [left, right].
export function displaySlots(state) {
  if (!state.spread) return [state.page];

  const odd = pairLeading(state.page);
  const even = odd + 1;
  const evenExists = even <= state.totalPages;

  if (state.dir === 'ltr') {
    return [odd, evenExists ? even : null];
  }
  // rtl: even on the left, odd on the right
  return [evenExists ? even : null, odd];
}

export function goToPage(state, page) {
  return { ...state, page: clampPage(Math.trunc(page), state.totalPages) };
}

export function next(state) {
  const step = state.spread ? 2 : 1;
  const from = state.spread ? pairLeading(state.page) : state.page;
  const target = from + step;
  if (target > state.totalPages) {
    return state.spread ? { ...state, page: from } : state;
  }
  return { ...state, page: target };
}

export function prev(state) {
  const step = state.spread ? 2 : 1;
  const from = state.spread ? pairLeading(state.page) : state.page;
  const target = from - step;
  if (target < 1) {
    return state.spread ? { ...state, page: from } : state;
  }
  return { ...state, page: target };
}

// Slider is 1-based and runs forward (value 1 = first pair/page). Matching the
// slider's visual direction to the binding is presentation (viewer mirrors it
// for rtl), so the mapping here stays direction-independent.
export function sliderMax(state) {
  return state.spread ? Math.ceil(state.totalPages / 2) : state.totalPages;
}

export function sliderValue(state) {
  return state.spread ? Math.floor((state.page - 1) / 2) + 1 : state.page;
}

export function pageFromSlider(state, value) {
  const step = clampSlider(state, value);
  return state.spread ? 2 * (step - 1) + 1 : step;
}

export function setSlider(state, value) {
  return goToPage(state, pageFromSlider(state, value));
}

function clampSlider(state, value) {
  const max = sliderMax(state);
  if (value < 1) return 1;
  if (value > max) return max;
  return Math.trunc(value);
}