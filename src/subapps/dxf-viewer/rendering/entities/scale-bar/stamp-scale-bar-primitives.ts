/**
 * ADR-583 Φ2.1 / ADR-608 — Scale-bar frame-primitive CANVAS stamper (SRP split).
 *
 * The on-screen backend of the shared scale-bar layout SSoT
 * (`bim/scale-bar/scale-bar-primitives.ts`): it maps each frame-space primitive
 * through the caller's `toScreen(s, t)` closure (which owns the world rotation +
 * `worldToScreen` Y-flip) and stamps it to a `CanvasRenderingContext2D`. Pure
 * canvas drawing — no coordinate math of its own, no store reads. Replaces the
 * former `draw-scale-bar-labels.ts` (which only stamped the numerals): the body
 * geometry now flows through the SAME primitive list, so the renderer and the
 * export decomposer can never drift (N.18).
 *
 * @see bim/scale-bar/scale-bar-primitives.ts — `buildScaleBarPrimitives` (the SSoT)
 * @see rendering/entities/ScaleBarRenderer.ts — the caller
 * @see config/text-rendering-config.ts — `buildUIFont` (the numeral font SSoT)
 */

import type { Point2D } from '../../types/Types';
import type { ScaleBarFramePrimitive } from '../../../bim/scale-bar/scale-bar-primitives';
import { buildUIFont } from '../../../config/text-rendering-config';

/** Below this on-screen cap height a numeral is unreadable — skip drawing labels. */
const MIN_LABEL_SCREEN_PX = 5;

export interface StampScaleBarContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly primitives: readonly ScaleBarFramePrimitive[];
  /** Frame mapper: (offset along axis, perpendicular offset) mm → screen px. */
  readonly toScreen: (s: number, t: number) => Point2D;
  /** View scale (screen px per model unit) — folds a label's model height to px. */
  readonly transformScale: number;
  /** Phase-resolved fill/stroke colour (bar body + numerals tint uniformly). */
  readonly color: string;
}

/** Stamp every frame primitive to the canvas. No-op-safe on an empty list. */
export function stampScaleBarPrimitives(rc: StampScaleBarContext): void {
  for (const prim of rc.primitives) {
    switch (prim.kind) {
      case 'segment':
        stampSegment(rc, prim.a, prim.b);
        break;
      case 'cell':
        stampCell(rc, prim.corners, prim.filled);
        break;
      case 'label':
        stampLabel(rc, prim.at, prim.text, prim.heightMm, prim.align);
        break;
    }
  }
}

function stampSegment(
  rc: StampScaleBarContext,
  a: { s: number; t: number },
  b: { s: number; t: number },
): void {
  const { ctx } = rc;
  const pa = rc.toScreen(a.s, a.t);
  const pb = rc.toScreen(b.s, b.t);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
}

function stampCell(
  rc: StampScaleBarContext,
  corners: readonly { s: number; t: number }[],
  filled: boolean,
): void {
  if (corners.length === 0) return;
  const { ctx } = rc;
  ctx.beginPath();
  corners.forEach((c, i) => {
    const p = rc.toScreen(c.s, c.t);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  if (filled) ctx.fill();
  ctx.stroke();
}

function stampLabel(
  rc: StampScaleBarContext,
  at: { s: number; t: number },
  text: string,
  heightMm: number,
  align: 'center' | 'left',
): void {
  const fontPx = heightMm * rc.transformScale;
  if (fontPx < MIN_LABEL_SCREEN_PX) return;
  const { ctx } = rc;
  const anchor = rc.toScreen(at.s, at.t);
  ctx.save();
  ctx.fillStyle = rc.color;
  ctx.font = buildUIFont(fontPx, 'arial', 'normal');
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, anchor.x, anchor.y);
  ctx.restore();
}
