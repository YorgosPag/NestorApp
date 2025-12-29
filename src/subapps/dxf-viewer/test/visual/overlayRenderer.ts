/**
 * 🎨 VISUAL REGRESSION TESTING - Overlay Renderer
 * Deterministic rendering για consistent visual snapshots
 * Enterprise-level visual testing infrastructure
 */

import type { Point2D, Viewport } from '../../rendering/types/Types';
import { UI_COLORS } from '../../config/color-config';

export interface VisualTestOptions {
  seed?: number;
  viewport?: Viewport;
  gridEnabled?: boolean;
  crosshairEnabled?: boolean;
  overlayType?: 'origin' | 'grid' | 'crosshair' | 'combined';
}

/**
 * 🎯 DETERMINISTIC OVERLAY RENDERING
 * Renders overlays με consistent output για visual regression testing
 */
export async function renderOverlayToCanvas(
  canvas: HTMLCanvasElement,
  opts: VisualTestOptions = {}
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2D context');

  // Set deterministic seed για consistent results
  const seed = opts.seed ?? 42;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set default viewport
  const viewport: Viewport = opts.viewport ?? {
    width: canvas.width,
    height: canvas.height
  };

  // Apply deterministic styling
  ctx.save();

  // Render based on overlay type
  switch (opts.overlayType) {
    case 'origin':
      await renderOriginMarkers(ctx, viewport, seed);
      break;
    case 'grid':
      await renderTestGrid(ctx, viewport, seed);
      break;
    case 'crosshair':
      await renderTestCrosshair(ctx, viewport, seed);
      break;
    case 'combined':
    default:
      await renderCombinedOverlay(ctx, viewport, seed);
      break;
  }

  ctx.restore();
}

/**
 * 🎯 ORIGIN MARKERS RENDERING
 * Deterministic origin marker rendering για visual testing
 */
async function renderOriginMarkers(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  seed: number
): Promise<void> {
  // Canvas origin (top-left)
  ctx.fillStyle = UI_COLORS.SELECTED_RED;
  ctx.fillRect(0, 0, 4, 4);

  // Canvas center
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  ctx.fillStyle = UI_COLORS.BRIGHT_GREEN;
  ctx.fillRect(centerX - 2, centerY - 2, 4, 4);

  // Corner markers για reference
  ctx.fillStyle = UI_COLORS.SNAP_CENTER;
  ctx.fillRect(viewport.width - 4, 0, 4, 4); // Top-right
  ctx.fillRect(0, viewport.height - 4, 4, 4); // Bottom-left
  ctx.fillRect(viewport.width - 4, viewport.height - 4, 4, 4); // Bottom-right
}

/**
 * 🔲 TEST GRID RENDERING
 * Deterministic grid για visual regression testing
 */
async function renderTestGrid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  seed: number
): Promise<void> {
  const gridSize = 50; // Fixed grid size για consistency

  ctx.strokeStyle = UI_COLORS.LIGHT_GRAY;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);

  ctx.beginPath();

  // Vertical lines
  for (let x = 0; x <= viewport.width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewport.height);
  }

  // Horizontal lines
  for (let y = 0; y <= viewport.height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(viewport.width, y);
  }

  ctx.stroke();

  // Major grid lines
  ctx.strokeStyle = UI_COLORS.RULER_LIGHT_GRAY;
  ctx.lineWidth = 2;
  ctx.beginPath();

  const majorInterval = 5;
  for (let x = 0; x <= viewport.width; x += gridSize * majorInterval) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewport.height);
  }

  for (let y = 0; y <= viewport.height; y += gridSize * majorInterval) {
    ctx.moveTo(0, y);
    ctx.lineTo(viewport.width, y);
  }

  ctx.stroke();
}

/**
 * ➕ TEST CROSSHAIR RENDERING
 * Deterministic crosshair για visual testing
 */
async function renderTestCrosshair(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  seed: number
): Promise<void> {
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;

  ctx.strokeStyle = UI_COLORS.DRAWING_HIGHLIGHT;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);

  ctx.beginPath();

  // Horizontal crosshair line
  ctx.moveTo(0, centerY);
  ctx.lineTo(viewport.width, centerY);

  // Vertical crosshair line
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, viewport.height);

  ctx.stroke();

  // Center circle
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * 🎨 COMBINED OVERLAY RENDERING
 * Renders multiple overlays για comprehensive testing
 */
async function renderCombinedOverlay(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  seed: number
): Promise<void> {
  // Render all overlays in sequence
  await renderTestGrid(ctx, viewport, seed);
  await renderOriginMarkers(ctx, viewport, seed);
  await renderTestCrosshair(ctx, viewport, seed);

  // Add test labels για identification
  ctx.fillStyle = UI_COLORS.BLACK;
  ctx.font = '12px monospace';
  ctx.fillText(`Seed: ${seed}`, 10, viewport.height - 10);
  ctx.fillText(`${viewport.width}x${viewport.height}`, 10, 20);
}

/**
 * 📐 COORDINATE SYSTEM TEST RENDERING
 * Specialized rendering για coordinate system testing
 */
export async function renderCoordinateSystemTest(
  canvas: HTMLCanvasElement,
  transform: { scale: number; offsetX: number; offsetY: number },
  opts: VisualTestOptions = {}
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2D context');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  // Apply transform
  ctx.translate(transform.offsetX, transform.offsetY);
  ctx.scale(transform.scale, transform.scale);

  // Render coordinate system markers
  const worldPoints: Point2D[] = [
    { x: 0, y: 0 },        // World origin
    { x: 100, y: 0 },      // X-axis point
    { x: 0, y: 100 },      // Y-axis point
    { x: 100, y: 100 },    // Diagonal point
  ];

  ctx.fillStyle = UI_COLORS.SELECTED_RED;
  worldPoints.forEach((point, index) => {
    ctx.fillRect(point.x - 2, point.y - 2, 4, 4);

    // Add labels
    ctx.fillStyle = UI_COLORS.BLACK;
    ctx.font = '10px monospace';
    ctx.fillText(`(${point.x},${point.y})`, point.x + 5, point.y - 5);
    ctx.fillStyle = UI_COLORS.SELECTED_RED;
  });

  ctx.restore();
}