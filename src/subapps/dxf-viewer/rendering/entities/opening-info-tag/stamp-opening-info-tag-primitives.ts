/**
 * ADR-612 — Opening Info Tag frame-primitive CANVAS stamper (SRP split).
 *
 * The on-screen backend of the shared opening-info-tag layout SSoT
 * (`bim/opening-info-tag/opening-info-tag-primitives.ts`): it maps each
 * frame-space primitive through the caller's `toScreen(u, v)` closure (which
 * owns the world rotation + `worldToScreen` Y-flip) and stamps it to a
 * `CanvasRenderingContext2D`. Pure canvas drawing — no coordinate math of its
 * own, no store reads. Mirrors `rendering/entities/scale-bar/stamp-scale-bar-primitives.ts`
 * (N.18 anti-clone) but only the `'segment'` / `'label'` kinds — the tag has
 * no `'cell'` primitive (its box outline is drawn via plain segments).
 *
 * @see bim/opening-info-tag/opening-info-tag-primitives.ts — `buildOpeningInfoTagPrimitives` (the SSoT)
 * @see rendering/entities/OpeningInfoTagRenderer.ts — the caller
 * @see config/text-rendering-config.ts — `buildUIFont` (the numeral font SSoT)
 */

import type { Point2D } from '../../types/Types';
import type { OpeningInfoTagFramePrimitive } from '../../../bim/opening-info-tag/opening-info-tag-primitives';
import { buildUIFont } from '../../../config/text-rendering-config';

/** Below this on-screen cap height a numeral is unreadable — skip drawing labels. */
const MIN_LABEL_SCREEN_PX = 5;

export interface StampOpeningInfoTagContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly primitives: readonly OpeningInfoTagFramePrimitive[];
  /** Frame mapper: (along-width mm, along-height mm) → screen px. */
  readonly toScreen: (u: number, v: number) => Point2D;
  /** View scale (screen px per model unit) — folds a label's world-mm height to px. */
  readonly transformScale: number;
  /** Phase-resolved fill/stroke colour (box outline + numerals tint uniformly). */
  readonly color: string;
}

/** Stamp every frame primitive to the canvas. No-op-safe on an empty list. */
export function stampOpeningInfoTagPrimitives(rc: StampOpeningInfoTagContext): void {
  for (const prim of rc.primitives) {
    switch (prim.kind) {
      case 'segment':
        stampSegment(rc, prim.a, prim.b);
        break;
      case 'label':
        stampLabel(rc, prim.at, prim.text, prim.heightMm, prim.align);
        break;
    }
  }
}

function stampSegment(
  rc: StampOpeningInfoTagContext,
  a: { u: number; v: number },
  b: { u: number; v: number },
): void {
  const { ctx } = rc;
  const pa = rc.toScreen(a.u, a.v);
  const pb = rc.toScreen(b.u, b.v);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
}

function stampLabel(
  rc: StampOpeningInfoTagContext,
  at: { u: number; v: number },
  text: string,
  heightMm: number,
  align: 'center',
): void {
  const fontPx = heightMm * rc.transformScale;
  if (fontPx < MIN_LABEL_SCREEN_PX) return;
  const { ctx } = rc;
  const anchor = rc.toScreen(at.u, at.v);
  ctx.save();
  ctx.fillStyle = rc.color;
  ctx.font = buildUIFont(fontPx, 'arial', 'normal');
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, anchor.x, anchor.y);
  ctx.restore();
}
