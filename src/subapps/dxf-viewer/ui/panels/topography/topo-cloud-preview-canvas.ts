/**
 * ADR-650 Milestone 8α — one-shot top-down scatter of the point-cloud preview.
 *
 * Pure canvas drawing, no React, no animation loop (the wizard step draws ONCE per result in a
 * `useEffect` — this is a static human-certifier snapshot, not a live viewport). Kept out of
 * `TopoCloudStep.tsx` so that component stays markup/wiring only, same split as the rest of the
 * wizard (`useTopoImport` = state, step components = render).
 *
 * `preview.positions` is LOCAL mm, interleaved xyz (three.js `BufferAttribute` layout — see
 * `PointCloudPreview` in `pointcloud-types.ts`). This function only ever reads x/y for the
 * top-down projection; z is display-only elsewhere (the 3D layer), never here.
 */

import type { PointCloudPreview } from '../../../systems/topography/pointcloud/pointcloud-types';

/** Fallback point colour (CSS) when the cloud carries no per-point classification colour. */
const FALLBACK_POINT_COLOR = '#5fb87a';
/** Canvas background (CSS) — dark, matches the wizard dialog surface. */
const BACKGROUND_COLOR = '#111318';
/** Padding (px) around the projected bounds so points never sit flush against the canvas edge. */
const PADDING_PX = 8;

/** Draw `preview` as a top-down (X/Y) scatter into `canvas`, replacing whatever was there. */
export function drawCloudPreview(canvas: HTMLCanvasElement, preview: PointCloudPreview, pointSizePx: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (preview.count === 0) return;

  const bounds = planarBounds(preview.positions);
  const project = projector(bounds, canvas.width, canvas.height);

  for (let i = 0; i < preview.count; i++) {
    const x = preview.positions[i * 3];
    const y = preview.positions[i * 3 + 1];
    const [px, py] = project(x, y);
    ctx.fillStyle = preview.colors ? rgbCss(preview.colors, i) : FALLBACK_POINT_COLOR;
    ctx.fillRect(px, py, pointSizePx, pointSizePx);
  }
}

interface PlanarBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Min/max of the LOCAL x/y in the interleaved buffer — the extent the projector maps to pixels. */
function planarBounds(positions: Float32Array): PlanarBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** LOCAL mm (x, y) → canvas px, uniformly scaled (no axis distortion) and Y-flipped (plan-up). */
function projector(bounds: PlanarBounds, width: number, height: number): (x: number, y: number) => readonly [number, number] {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const usableW = width - PADDING_PX * 2;
  const usableH = height - PADDING_PX * 2;
  const scale = Math.min(usableW / spanX, usableH / spanY);
  const offsetX = PADDING_PX + (usableW - spanX * scale) / 2;
  const offsetY = PADDING_PX + (usableH - spanY * scale) / 2;

  return (x: number, y: number) => [
    offsetX + (x - bounds.minX) * scale,
    height - (offsetY + (y - bounds.minY) * scale),
  ];
}

/** `colors[i*3..i*3+2]` are 0..1 RGB → a CSS `rgb()` string for `fillStyle`. */
function rgbCss(colors: Float32Array, i: number): string {
  const r = Math.round(colors[i * 3] * 255);
  const g = Math.round(colors[i * 3 + 1] * 255);
  const b = Math.round(colors[i * 3 + 2] * 255);
  return `rgb(${r} ${g} ${b})`;
}
