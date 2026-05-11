/**
 * Hybrid Eyedropper — native `EyeDropper` API where supported, DOM/canvas
 * fallback with enterprise loupe magnifier otherwise.
 *
 * Coverage matrix:
 * | Source                | Native API | Fallback |
 * |-----------------------|------------|----------|
 * | Anywhere on screen    | ✅         | ❌       |
 * | Page DOM (any color)  | ✅         | ✅       |
 * | Canvas element pixels | ✅         | ✅       |
 *
 * Pattern: Figma / Canva / Adobe Express in-browser color sampling.
 */

import { createLoupe, type LoupeHandle } from './eyedropper-loupe';

export interface EyedropperResult {
  sRGBHex: string;
}

interface NativeEyeDropperCtor {
  new (): { open: () => Promise<EyedropperResult> };
}

/** True if the browser exposes the native EyeDropper API. */
export function hasNativeEyedropper(): boolean {
  return typeof window !== 'undefined' && 'EyeDropper' in window;
}

/** Firefox has EyeDropper API but no built-in loupe — force custom fallback. */
function prefersCustomFallback(): boolean {
  return typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent);
}

/**
 * Open the eyedropper. Resolves with the picked color, rejects on cancel.
 * Chrome/Edge → native API (built-in loupe). Firefox + no-API → DOM/canvas
 * fallback with enterprise loupe magnifier.
 */
export function openEyedropper(): Promise<EyedropperResult> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Eyedropper unavailable: no window'));
  }
  const NativeCtor = (window as Window & { EyeDropper?: NativeEyeDropperCtor }).EyeDropper;
  if (NativeCtor && !prefersCustomFallback()) {
    return new NativeCtor().open();
  }
  return openDomEyedropper();
}

// ─── DOM/canvas fallback with loupe magnifier ────────────────────────────────

function openDomEyedropper(): Promise<EyedropperResult> {
  return new Promise((resolve, reject) => {
    // Hide OS cursor + DXF CAD overlays (crosshair canvas, snap indicator).
    // The CrosshairOverlay is a <canvas> at z-20 that draws opaque lines under
    // the cursor — without hiding it, findCanvasAtPoint would pick it as the
    // zoom source instead of the DxfCanvas beneath.
    const sessionStyle = document.createElement('style');
    sessionStyle.textContent = '*{cursor:none!important}[data-dxf-overlay]{visibility:hidden!important}';
    document.head.appendChild(sessionStyle);

    // Loupe appears immediately — no DOM snapshot needed
    const loupe: LoupeHandle = createLoupe();

    let rafPending = false;
    let lastX = 0;
    let lastY = 0;

    const cleanup = (): void => {
      sessionStyle.remove();
      loupe.destroy();
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
    };

    const onMouseMove = (e: MouseEvent): void => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const payload = resolveZoomSource(lastX, lastY);
        loupe.update(lastX, lastY, payload.source, payload.snapX, payload.snapY, payload.hex);
      });
    };

    const onClick = (e: MouseEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      const color = readColorAtPoint(e.clientX, e.clientY);
      if (color) resolve({ sRGBHex: color });
      else reject(new Error('Eyedropper: could not read pixel'));
    };

    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault();
      cleanup();
      reject(new Error('Eyedropper cancelled'));
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        cleanup();
        reject(new Error('Eyedropper cancelled'));
      }
    };

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('keydown', onKey, true);
  });
}

// ─── Zoom source resolution ──────────────────────────────────────────────────

interface ZoomPayload {
  source: HTMLCanvasElement | null;
  snapX: number;
  snapY: number;
  hex: string;
}

/**
 * Resolve zoom source and hex color at cursor (x, y).
 *
 * Uses `elementsFromPoint` (all layers) to penetrate transparent overlays.
 * Skips canvases with transparent pixels (alpha < 10) so overlay guide
 * canvases don't shadow the main DXF rendering canvas beneath them.
 *
 * If no opaque canvas found → source = null, loupe renders a solid-color fill.
 */
function resolveZoomSource(x: number, y: number): ZoomPayload {
  const elements = document.elementsFromPoint(x, y);

  for (const el of elements) {
    if (!(el instanceof HTMLCanvasElement)) continue;

    const rect = el.getBoundingClientRect();
    const scaleX = el.width / rect.width;
    const scaleY = el.height / rect.height;
    const snapX = (x - rect.left) * scaleX;
    const snapY = (y - rect.top) * scaleY;

    const pixel = readCanvasPixelAt(el, snapX, snapY);
    if (pixel === null) continue; // transparent — keep searching

    return { source: el, snapX, snapY, hex: pixel };
  }

  // No opaque canvas found — fall back to CSS color, loupe shows solid fill
  const hex = readCssColorAtPoint(x, y) ?? '#000000';
  return { source: null, snapX: 0, snapY: 0, hex };
}

// ─── Canvas pixel reading ────────────────────────────────────────────────────

/**
 * Read pixel at canvas coordinates (cx, cy) already scaled to canvas space.
 * Returns null for transparent pixels (alpha < 10) or read errors.
 * Uses an offscreen copy to avoid SecurityError on willReadFrequently mismatch.
 */
function readCanvasPixelAt(canvas: HTMLCanvasElement, cx: number, cy: number): string | null {
  const x = Math.max(0, Math.min(Math.round(cx), canvas.width - 1));
  const y = Math.max(0, Math.min(Math.round(cy), canvas.height - 1));
  try {
    // Copy 1×1 pixel to a fresh offscreen canvas — avoids context-option conflicts
    const offscreen = document.createElement('canvas');
    offscreen.width = 1;
    offscreen.height = 1;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(canvas, x, y, 1, 1, 0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[3] < 10) return null; // transparent — skip
    return rgbToHex(d[0], d[1], d[2]);
  } catch {
    return null;
  }
}

// ─── DOM color reading ───────────────────────────────────────────────────────

/**
 * Read color at viewport point for the final committed value on click.
 * Traverses all stacked elements so canvas beneath overlays is not missed.
 */
function readColorAtPoint(x: number, y: number): string | null {
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    if (el instanceof HTMLCanvasElement) {
      const rect = el.getBoundingClientRect();
      const cx = (x - rect.left) * (el.width / rect.width);
      const cy = (y - rect.top) * (el.height / rect.height);
      const pixel = readCanvasPixelAt(el, cx, cy);
      if (pixel !== null) return pixel;
    }
  }
  return readCssColorAtPoint(x, y);
}

function readCssColorAtPoint(x: number, y: number): string | null {
  const elements = document.elementsFromPoint(x, y);
  const top = elements[0];
  return top ? readBackgroundUp(top) : null;
}

function readBackgroundUp(start: Element): string | null {
  let current: Element | null = start;
  while (current) {
    const rgb = parseRgbColor(getComputedStyle(current).backgroundColor);
    if (rgb && rgb.a > 0) return rgbToHex(rgb.r, rgb.g, rgb.b);
    current = current.parentElement;
  }
  return null;
}

function parseRgbColor(css: string): { r: number; g: number; b: number; a: number } | null {
  const match = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] !== undefined ? Number(match[4]) : 1,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const hex = (v: number): string => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
