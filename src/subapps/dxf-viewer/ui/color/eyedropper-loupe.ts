/**
 * Enterprise Eyedropper Loupe — Figma-style magnifier overlay.
 * Imperative DOM component: create once, update on mousemove, destroy on done.
 * Pattern: Figma / Canva / Adobe Express in-browser loupe.
 */

const LOUPE_SIZE = 120;
const ZOOM_SOURCE = 12; // 12×12 px → 120×120 = 10× zoom
const OFFSET_X = 16;
const LABEL_HEIGHT = 22;

export interface LoupeHandle {
  update(x: number, y: number, snapshot: HTMLCanvasElement, hex: string): void;
  destroy(): void;
}

export function createLoupe(): LoupeHandle {
  const container = document.createElement('div');
  applyContainerStyles(container);

  const canvas = document.createElement('canvas');
  canvas.width = LOUPE_SIZE;
  canvas.height = LOUPE_SIZE;
  canvas.style.cssText = 'display:block;border-radius:4px 4px 0 0;';

  const label = document.createElement('div');
  applyLabelStyles(label);

  container.appendChild(canvas);
  container.appendChild(label);
  document.body.appendChild(container);

  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  return {
    update(x: number, y: number, snapshot: HTMLCanvasElement, hex: string): void {
      placeLoupe(container, x, y);
      renderZoom(ctx, snapshot, x, y);
      renderCrosshair(ctx);
      label.textContent = hex;
    },
    destroy(): void {
      container.remove();
    },
  };
}

function applyContainerStyles(el: HTMLDivElement): void {
  el.setAttribute('aria-label', 'Color picker loupe');
  el.setAttribute('role', 'img');
  Object.assign(el.style, {
    position: 'fixed',
    width: `${LOUPE_SIZE}px`,
    borderRadius: '6px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
    border: '1.5px solid rgba(255,255,255,0.22)',
    pointerEvents: 'none',
    zIndex: '2147483647',
    overflow: 'hidden',
    backgroundColor: '#111',
  });
}

function applyLabelStyles(el: HTMLDivElement): void {
  Object.assign(el.style, {
    textAlign: 'center',
    fontSize: '11px',
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
    color: '#fff',
    backgroundColor: '#111',
    padding: '3px 0',
    letterSpacing: '0.06em',
    lineHeight: `${LABEL_HEIGHT - 6}px`,
    height: `${LABEL_HEIGHT}px`,
    userSelect: 'none',
  });
}

function placeLoupe(container: HTMLDivElement, x: number, y: number): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const totalH = LOUPE_SIZE + LABEL_HEIGHT;
  let left = x + OFFSET_X;
  let top = y - LOUPE_SIZE - OFFSET_X;

  if (left + LOUPE_SIZE > vw - 4) left = x - LOUPE_SIZE - OFFSET_X;
  if (top < 4) top = y + OFFSET_X;
  if (top + totalH > vh - 4) top = y - totalH - 4;

  container.style.left = `${Math.round(left)}px`;
  container.style.top = `${Math.round(top)}px`;
}

function renderZoom(
  ctx: CanvasRenderingContext2D,
  snapshot: HTMLCanvasElement,
  x: number,
  y: number
): void {
  ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
  ctx.imageSmoothingEnabled = false;
  const half = Math.floor(ZOOM_SOURCE / 2);
  ctx.drawImage(snapshot, Math.round(x) - half, Math.round(y) - half, ZOOM_SOURCE, ZOOM_SOURCE, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
}

function renderCrosshair(ctx: CanvasRenderingContext2D): void {
  const cx = LOUPE_SIZE / 2;
  const cy = LOUPE_SIZE / 2;
  const arm = 8;

  ctx.save();
  // Dark shadow stroke for contrast on any background
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();
  // Bright white inner stroke
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();
  ctx.restore();
}
