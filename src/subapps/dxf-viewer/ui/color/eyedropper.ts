/**
 * Hybrid Eyedropper — native `EyeDropper` API where supported, DOM/canvas
 * fallback with enterprise loupe magnifier otherwise.
 *
 * Coverage matrix:
 * | Source                                  | Native API | Fallback |
 * |-----------------------------------------|------------|----------|
 * | Browser chrome / OS desktop / other apps| ✅         | ❌       |
 * | Any element in the page DOM             | ✅         | ✅       |
 * | Canvas element pixels                   | ✅         | ✅       |
 * | Image element pixels                    | ✅         | ✅       |
 * | CSS background-color (buttons, etc.)    | ✅         | ✅       |
 *
 * Pattern: Figma / Canva / Adobe Express in-browser color sampling.
 * For OS-level "anywhere on screen" coverage in the fallback, a future
 * enhancement could integrate `getDisplayMedia()` screen capture.
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
    // Session styles: hide OS cursor + hide DXF CAD overlays.
    const sessionStyle = document.createElement('style');
    sessionStyle.textContent = '*{cursor:none!important}[data-dxf-overlay]{visibility:hidden!important}';
    document.head.appendChild(sessionStyle);

    // Capture overlay blocks ALL pointer interaction with underlying UI
    // (no hover state on buttons, no accidental click-through). Loupe stays
    // above the overlay via higher z-index.
    const captureOverlay = document.createElement('div');
    captureOverlay.setAttribute('data-eyedropper-capture', 'true');
    captureOverlay.setAttribute('aria-hidden', 'true');
    Object.assign(captureOverlay.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'all',
      background: 'transparent',
      zIndex: '2147483646',
    });
    document.body.appendChild(captureOverlay);

    const loupe: LoupeHandle = createLoupe();

    let rafPending = false;
    let lastX = 0;
    let lastY = 0;

    const cleanup = (): void => {
      sessionStyle.remove();
      captureOverlay.remove();
      loupe.destroy();
      document.removeEventListener('keydown', onKey, true);
    };

    const onMouseMove = (e: MouseEvent): void => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const p = pickAt(lastX, lastY);
        loupe.update(lastX, lastY, p.source, p.snapX, p.snapY, p.hex);
      });
    };

    const onClick = (e: MouseEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      const p = pickAt(e.clientX, e.clientY);
      cleanup();
      resolve({ sRGBHex: p.hex });
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

    captureOverlay.addEventListener('mousemove', onMouseMove);
    captureOverlay.addEventListener('click', onClick);
    captureOverlay.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKey, true);
  });
}

// ─── Pick resolution ─────────────────────────────────────────────────────────

interface PickPayload {
  /** Zoom source for loupe (canvas or image). null → loupe shows solid fill. */
  source: CanvasImageSource | null;
  /** Source-space coords for zoom rectangle center. */
  snapX: number;
  snapY: number;
  /** Hex color at exactly (clientX, clientY). */
  hex: string;
}

/**
 * Resolve the pixel/color at viewport position (x, y).
 *
 * Walks `elementsFromPoint` top-down. The first opaque layer wins:
 *  - `<canvas>` with non-transparent pixel → real zoom + canvas pixel
 *  - `<img>` with non-transparent pixel → real zoom + image pixel
 *  - Any HTMLElement with opaque background-color → solid fill + CSS color
 *  - Otherwise skip (transparent, look at next layer)
 *
 * Excludes the eyedropper's own capture overlay so it doesn't shadow the page.
 */
function pickAt(x: number, y: number): PickPayload {
  const elements = elementsAtPointFiltered(x, y);

  for (const el of elements) {
    if (el instanceof HTMLCanvasElement) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const snapX = (x - rect.left) * (el.width / rect.width);
      const snapY = (y - rect.top) * (el.height / rect.height);
      const hex = readCanvasPixelAt(el, snapX, snapY);
      if (hex !== null) return { source: el, snapX, snapY, hex };
      continue;
    }

    if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const snapX = (x - rect.left) * (el.naturalWidth / rect.width);
      const snapY = (y - rect.top) * (el.naturalHeight / rect.height);
      const hex = readImagePixelAt(el, snapX, snapY);
      if (hex !== null) return { source: el, snapX, snapY, hex };
      continue;
    }

    if (el instanceof HTMLElement) {
      const rgb = parseRgbColor(getComputedStyle(el).backgroundColor);
      if (rgb && rgb.a >= 0.5) {
        return { source: null, snapX: 0, snapY: 0, hex: rgbToHex(rgb.r, rgb.g, rgb.b) };
      }
    }
  }

  return { source: null, snapX: 0, snapY: 0, hex: '#000000' };
}

/** elementsFromPoint, minus the eyedropper's own capture overlay. */
function elementsAtPointFiltered(x: number, y: number): Element[] {
  return document.elementsFromPoint(x, y).filter(
    (el) => !(el instanceof HTMLElement) || el.dataset.eyedropperCapture !== 'true'
  );
}

// ─── Pixel reading helpers ───────────────────────────────────────────────────

/**
 * Read pixel from a canvas at canvas-space coords (cx, cy).
 * Returns null for transparent pixels (alpha < 10) or read errors.
 * Uses 1×1 offscreen copy to avoid willReadFrequently context conflicts.
 */
function readCanvasPixelAt(canvas: HTMLCanvasElement, cx: number, cy: number): string | null {
  const x = Math.max(0, Math.min(Math.round(cx), canvas.width - 1));
  const y = Math.max(0, Math.min(Math.round(cy), canvas.height - 1));
  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = 1;
    offscreen.height = 1;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(canvas, x, y, 1, 1, 0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[3] < 10) return null;
    return rgbToHex(d[0], d[1], d[2]);
  } catch {
    return null;
  }
}

/**
 * Read pixel from an <img> at natural-pixel coords (ix, iy).
 * Returns null for transparent pixels or CORS-tainted images.
 */
function readImagePixelAt(img: HTMLImageElement, ix: number, iy: number): string | null {
  const x = Math.max(0, Math.min(Math.round(ix), img.naturalWidth - 1));
  const y = Math.max(0, Math.min(Math.round(iy), img.naturalHeight - 1));
  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = 1;
    offscreen.height = 1;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, x, y, 1, 1, 0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[3] < 10) return null;
    return rgbToHex(d[0], d[1], d[2]);
  } catch {
    return null;
  }
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
