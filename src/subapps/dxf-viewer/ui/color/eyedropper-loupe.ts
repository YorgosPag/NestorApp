/**
 * Enterprise Eyedropper Loupe — Figma-style magnifier overlay.
 * Imperative DOM component: create once, update on mousemove, destroy on done.
 * Pattern: Figma / Canva / Adobe Express in-browser loupe.
 */

const LOUPE_SIZE = 120;
const ZOOM_SOURCE = 12; // 12×12 px → 120×120 = 10× zoom
const LABEL_HEIGHT = 22;

export interface LoupeHandle {
  /** source=null → solid color fill. source=canvas/image → zoomed pixel content. */
  update(screenX: number, screenY: number, source: CanvasImageSource | null, snapX: number, snapY: number, hex: string): void;
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
    update(screenX: number, screenY: number, source: CanvasImageSource | null, snapX: number, snapY: number, hex: string): void {
      placeLoupe(container, screenX, screenY);
      if (source) {
        renderZoom(ctx, source, snapX, snapY);
        renderCrosshair(ctx);
      } else {
        renderSolidColor(ctx, hex);
      }
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

/**
 * Center the loupe CANVAS (not the full container) on the cursor.
 * The label sits below the loupe inside the same container.
 * Chrome native EyeDropper style: loupe is the cursor indicator.
 */
function placeLoupe(container: HTMLDivElement, x: number, y: number): void {
  container.style.left = `${Math.round(x - LOUPE_SIZE / 2)}px`;
  container.style.top = `${Math.round(y - LOUPE_SIZE / 2)}px`;
}

function renderSolidColor(ctx: CanvasRenderingContext2D, hex: string): void {
  ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
  renderCrosshair(ctx);
}

function renderZoom(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number
): void {
  ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
  ctx.imageSmoothingEnabled = false;
  const half = Math.floor(ZOOM_SOURCE / 2);
  ctx.drawImage(source, Math.round(x) - half, Math.round(y) - half, ZOOM_SOURCE, ZOOM_SOURCE, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
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
