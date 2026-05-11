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
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    let loupe: LoupeHandle | null = null;
    let snapshot: HTMLCanvasElement | null = null;
    let rafPending = false;
    let lastX = 0;
    let lastY = 0;

    // Snapshot + loupe: fire-and-forget — degrade gracefully if it fails
    initLoupeAsync()
      .then((h) => {
        snapshot = h.snapshot;
        loupe = h.loupe;
      })
      .catch(() => { /* loupe unavailable — crosshair cursor still active */ });

    const cleanup = (): void => {
      document.body.style.cursor = prevCursor;
      loupe?.destroy();
      loupe = null;
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
    };

    const onMouseMove = (e: MouseEvent): void => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (rafPending || !loupe || !snapshot) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        if (!loupe || !snapshot) return;
        const hex = readSnapshotPixel(snapshot, lastX, lastY) ?? '#000000';
        loupe.update(lastX, lastY, snapshot, hex);
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

async function initLoupeAsync(): Promise<{ loupe: LoupeHandle; snapshot: HTMLCanvasElement }> {
  const { domToCanvas } = await import('modern-screenshot');
  const canvas = await domToCanvas(document.body, {
    width: window.innerWidth,
    height: window.innerHeight,
    scale: 1,
  });
  return { loupe: createLoupe(), snapshot: canvas };
}

function readSnapshotPixel(snapshot: HTMLCanvasElement, x: number, y: number): string | null {
  const cx = Math.max(0, Math.min(Math.round(x), snapshot.width - 1));
  const cy = Math.max(0, Math.min(Math.round(y), snapshot.height - 1));
  try {
    const ctx = snapshot.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const d = ctx.getImageData(cx, cy, 1, 1).data;
    return rgbToHex(d[0], d[1], d[2]);
  } catch {
    return null;
  }
}

// ─── DOM color reading ───────────────────────────────────────────────────────

function readColorAtPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;

  if (el instanceof HTMLCanvasElement) {
    const pixel = readCanvasPixel(el, x, y);
    if (pixel) return pixel;
    // Tainted canvas falls through to background scan.
  }
  return readBackgroundUp(el);
}

function readCanvasPixel(canvas: HTMLCanvasElement, x: number, y: number): string | null {
  try {
    const rect = canvas.getBoundingClientRect();
    const px = Math.round(((x - rect.left) / rect.width) * canvas.width);
    const py = Math.round(((y - rect.top) / rect.height) * canvas.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const data = ctx.getImageData(px, py, 1, 1).data;
    return rgbToHex(data[0], data[1], data[2]);
  } catch {
    return null;
  }
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
