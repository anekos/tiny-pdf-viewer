// viewer.js — entry point. Reads URL params, wires the UI, and connects
// navigation (pure logic) to pdf-core (rendering). DESIGN.md §4, §7.

import * as nav from './navigation.js';
import { loadDocument, pdfjsVersion } from './pdf-core.js';

// Below this stage width a spread would shrink each page too much, so we
// fall back to single-page rendering while keeping the user's spread setting.
const NARROW_BREAKPOINT = 700;

const els = {
  stage: document.getElementById('stage'),
  pages: document.getElementById('pages'),
  canvases: [document.getElementById('canvas0'), document.getElementById('canvas1')],
  prev: document.getElementById('prev'),
  next: document.getElementById('next'),
  slider: document.getElementById('slider'),
  indicator: document.getElementById('page-indicator'),
  toggleSpread: document.getElementById('toggle-spread'),
  toggleFullscreen: document.getElementById('toggle-fullscreen'),
  message: document.getElementById('message'),
  messageBox: document.querySelector('#message .box'),
};

let doc = null;
let state = null; // navigation state; state.spread is the user's intent
let renderToken = 0; // guards against out-of-order async renders
// Physical buttons resolved to reading actions (swapped for rtl, see wireUi).
let advanceBtn = null; // moves forward in reading order
let retreatBtn = null; // moves backward in reading order

function showMessage(text) {
  els.messageBox.textContent = text;
  els.message.classList.add('show');
}

function parseParams() {
  const p = new URLSearchParams(location.search);
  const pageRaw = parseInt(p.get('page') ?? '', 10);
  return {
    fileUrl: p.get('file_url'),
    page: Number.isFinite(pageRaw) ? pageRaw : 1,
    dir: p.get('dir') ?? 'rtl', // createState validates unknown values
    spread: (p.get('spread') ?? 'on') !== 'off',
  };
}

function isNarrow() {
  return els.stage.clientWidth < NARROW_BREAKPOINT;
}

// The state actually shown: user intent, but forced to single on narrow screens.
function viewState() {
  return { ...state, spread: state.spread && !isNarrow() };
}

function setPage(page) {
  state = { ...state, page };
  render();
}

async function render() {
  const view = viewState();
  const slots = nav.displaySlots(view);
  const token = ++renderToken;

  // Toolbar state
  els.slider.max = String(nav.sliderMax(view));
  els.slider.value = String(nav.sliderValue(view));
  els.slider.disabled = false;
  retreatBtn.disabled = view.page <= 1;
  advanceBtn.disabled = view.page >= state.totalPages;
  els.toggleSpread.textContent = state.spread ? '見開き' : '単ページ';
  const shown = slots.filter((n) => n != null);
  els.indicator.textContent = `${shown.join('–')} / ${state.totalPages}`;

  // Fit the whole spread inside the stage (contain-fit): each slot gets an equal
  // share of the width, and the full stage height, so nothing overflows and no
  // scrolling is needed. The page itself is letterboxed within that box.
  const pagesStyle = getComputedStyle(els.pages);
  const gap = parseFloat(pagesStyle.gap) || 0;
  const padX = (parseFloat(pagesStyle.paddingLeft) || 0) + (parseFloat(pagesStyle.paddingRight) || 0);
  const padY = (parseFloat(pagesStyle.paddingTop) || 0) + (parseFloat(pagesStyle.paddingBottom) || 0);
  const availW = els.stage.clientWidth - gap * (slots.length - 1) - padX;
  const boxWidth = Math.max(1, Math.floor(availW / slots.length));
  const boxHeight = Math.max(1, Math.floor(els.stage.clientHeight - padY));
  const dpr = window.devicePixelRatio || 1;

  await Promise.all(
    els.canvases.map(async (canvas, i) => {
      const pageNumber = slots[i];
      if (pageNumber == null) {
        canvas.classList.add('hidden');
        return;
      }
      canvas.classList.remove('hidden');
      try {
        await doc.renderPage(pageNumber, canvas, { boxWidth, boxHeight, dpr });
      } catch (err) {
        if (token === renderToken) {
          console.error(`ページ ${pageNumber} の描画に失敗しました`, err);
        }
      }
    }),
  );
}

function wireUi() {
  const advance = () => setPage(nav.next(viewState()).page);
  const retreat = () => setPage(nav.prev(viewState()).page);

  // els.prev is the physical left button (◀), els.next the right (▶); the arrows
  // always point at where the thumb moves. For rtl the slider is mirrored and
  // reading runs right→left, so advancing moves the thumb left = the left button.
  if (state.dir === 'rtl') {
    els.slider.classList.add('rtl');
    advanceBtn = els.prev;
    retreatBtn = els.next;
  } else {
    advanceBtn = els.next;
    retreatBtn = els.prev;
  }
  advanceBtn.addEventListener('click', advance);
  retreatBtn.addEventListener('click', retreat);

  els.slider.addEventListener('input', () => {
    setPage(nav.setSlider(viewState(), Number(els.slider.value)).page);
  });
  els.toggleSpread.addEventListener('click', () => {
    state = { ...state, spread: !state.spread };
    render();
  });
  els.toggleFullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      els.stage.requestFullscreen?.();
    }
  });
  document.addEventListener('fullscreenchange', render);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') els.prev.click();
    else if (e.key === 'ArrowRight') els.next.click();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 100);
  });
}

async function main() {
  console.info(`pdf.js ${pdfjsVersion}`);
  const params = parseParams();

  if (!params.fileUrl) {
    showMessage('file_url パラメタが指定されていません。\n例: index.html?file_url=/pdfs/sample.pdf');
    return;
  }

  try {
    doc = await loadDocument(params.fileUrl);
  } catch (err) {
    console.error('PDF の読み込みに失敗しました', err);
    showMessage(`PDF の読み込みに失敗しました:\n${params.fileUrl}\n\n${err?.message ?? err}`);
    return;
  }

  state = nav.createState({
    totalPages: doc.numPages,
    page: params.page,
    dir: params.dir,
    spread: params.spread,
  });

  wireUi();
  render();
}

main();