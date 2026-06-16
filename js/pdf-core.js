// pdf-core.js — thin wrapper that confines pdfjs-dist.
//
// Responsibilities (DESIGN.md §4):
//   - load a document, expose page count
//   - render a given page into a <canvas> at a target CSS width (DPR-aware)
// Everything pdfjs-specific lives here so an API change is localized.

import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';

// Resolve the worker relative to this module so deployment is "drop the folder".
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../vendor/pdfjs/pdf.worker.min.mjs',
  import.meta.url,
).href;

export const pdfjsVersion = pdfjsLib.version;

class PdfDocument {
  constructor(doc) {
    this._doc = doc;
    // One in-flight render task per canvas, so a re-render cancels the old one.
    this._renderTasks = new WeakMap();
  }

  get numPages() {
    return this._doc.numPages;
  }

  // Render `pageNumber` into `canvas`, contained within a `boxWidth`x`boxHeight`
  // CSS-pixel box (aspect preserved). Re-rendering the same canvas cancels the
  // previous render rather than racing it.
  async renderPage(pageNumber, canvas, { boxWidth, boxHeight, dpr = 1 }) {
    const previous = this._renderTasks.get(canvas);
    if (previous) previous.cancel();

    const page = await this._doc.getPage(pageNumber);
    const unscaled = page.getViewport({ scale: 1 });
    // Contain-fit: scale so the whole page fits inside the box (no overflow),
    // bound by whichever of width/height is the tighter constraint.
    const scale = Math.min(boxWidth / unscaled.width, boxHeight / unscaled.height);
    const viewport = page.getViewport({ scale: scale * dpr });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const cssWidth = viewport.width / dpr;
    const cssHeight = viewport.height / dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const task = page.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
    });
    this._renderTasks.set(canvas, task);

    try {
      await task.promise;
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') throw err;
    } finally {
      if (this._renderTasks.get(canvas) === task) {
        this._renderTasks.delete(canvas);
      }
    }
    return cssHeight;
  }

  destroy() {
    return this._doc.destroy();
  }
}

// Load a PDF by URL. Range Requests only: never download the whole file up front
// (DESIGN.md §2). The server must support Accept-Ranges / 206 for this to help.
export async function loadDocument(url) {
  const loadingTask = pdfjsLib.getDocument({
    url,
    disableAutoFetch: true,
    disableStream: true,
  });
  const doc = await loadingTask.promise;
  return new PdfDocument(doc);
}