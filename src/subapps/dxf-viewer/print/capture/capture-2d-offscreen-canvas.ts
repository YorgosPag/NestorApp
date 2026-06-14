/**
 * ADR-453 — Print/Export engine · offscreen 2D render target.
 *
 * Builds a detached canvas at paper resolution and a `DxfRenderer` bound to it.
 * Mirrors the offscreen + getBoundingClientRect-stub technique used by
 * `dxf-bitmap-cache.ts` (lines 207-221), but at 1:1 (no DPR) since the canvas
 * pixels ARE the physical print pixels. Not on the ADR-040 hot path.
 *
 * @module subapps/dxf-viewer/print/capture/capture-2d-offscreen-canvas
 */

import { DxfRenderer } from '../../canvas-v2/dxf-canvas/DxfRenderer';

export interface Offscreen2dTarget {
  canvas: HTMLCanvasElement;
  renderer: DxfRenderer;
}

/**
 * Create a detached canvas of `widthPx × heightPx` with a stubbed
 * `getBoundingClientRect` (so `canvasBoundsService` resolves real bounds for a
 * DOM-detached canvas) and a `DxfRenderer` ready to paint into it.
 *
 * The canvas is left transparent — `DxfRenderer.render` clears it and the dark
 * background of the live viewer is intentionally NOT reproduced, so entities
 * land on the PDF's white page. (White/by-layer-white entities are invisible on
 * white; pen-table-aware print colours are a future slice.)
 */
export function createOffscreen2dTarget(widthPx: number, heightPx: number): Offscreen2dTarget {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  canvas.style.width = `${widthPx}px`;
  canvas.style.height = `${heightPx}px`;

  const bounds: DOMRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: widthPx,
    bottom: heightPx,
    width: widthPx,
    height: heightPx,
    toJSON() {
      return this;
    },
  } as DOMRect;
  canvas.getBoundingClientRect = () => bounds;

  const renderer = new DxfRenderer(canvas);
  return { canvas, renderer };
}
