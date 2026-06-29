/**
 * CROSSHAIR COMPOSITOR PAINT — pure Canvas2D renderer (ADR-549 Phase 6).
 *
 * Big-player low-latency presentation: the CAD crosshair is drawn into a
 * `desynchronized` Canvas2D context SYNCHRONOUSLY on every pointer move (the
 * Figma / Onshape / Excalidraw path), instead of a DOM `translate3d` layer that
 * is locked to the vsync compositor present. Browser-proven (ADR-549 Phase 5/6
 * bisection): with EVERY scene/overlay/2D render killed, a DOM crosshair still
 * «swims» behind the pointer — the residual is pure compositor present latency
 * of the promoted DOM layer. A desynchronized-canvas crosshair tracks tighter
 * (A/B verified 2026-06-29), so the render target moves DOM → canvas.
 *
 * This module is the PURE draw — no DOM, no React, no canvas allocation — so it
 * is unit-testable and shared verbatim by the 2D and 3D hosts (via the
 * `CrosshairCompositor`). Geometry (arm length / centre gap) is reused from
 * `crosshair-compositor-layout` — ONE source of truth for both render targets.
 *
 * @module canvas-v2/overlays/crosshair-compositor-paint
 */

import type { CrosshairLineStyle } from './crosshair-compositor-layout';

/** Fully-resolved per-frame crosshair descriptor (everything is pre-computed by the host). */
export interface CrosshairPaintFrame {
  /** Crosshair centre in CANVAS CSS px (overlay space — area origin already added). */
  readonly cx: number;
  readonly cy: number;
  /** Clip rectangle in CANVAS CSS px (the drawable area, so arms never spill onto rulers). */
  readonly clip: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly color: string;
  readonly opacity: number;
  readonly lineWidth: number;
  readonly lineStyle: CrosshairLineStyle;
  /** Length of each arm (CSS px) + the centre gap (CSS px) — from the layout SSoT. */
  readonly armLength: number;
  readonly gap: number;
  /** AutoCAD aperture / APBOX — already gated by showAperture && size>0 && !snapActive. */
  readonly aperture: { readonly visible: boolean; readonly size: number };
  /** "+"/"−" selection badge — already decided by the shared `resolveHoverBadge` SSoT. */
  readonly badge:
    | { readonly visible: false }
    | { readonly visible: true; readonly text: string; readonly color: string; readonly backgroundColor: string };
}

/** Badge box side (CSS px) — mirrors the previous DOM badge (11×11, monospace 11px). */
const BADGE_PX = 11;

/** Extra clearance (CSS px) baked around every dirty band so antialiasing / dash never leaves a 1px trail. */
const DIRTY_PAD = 2;

/** A rectangle (CSS px) the caller must `clearRect` before the next paint. */
export interface ClearRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Inputs needed to derive the dirty bands of a painted crosshair frame. */
export interface CrosshairClearInput {
  readonly cx: number;
  readonly cy: number;
  /** Arm reach BEFORE the gap is added (== `computeArmLength`). */
  readonly armLength: number;
  readonly gap: number;
  readonly lineWidth: number;
  /** Aperture side (CSS px) — 0 when the centre square is hidden. */
  readonly aperture: number;
  /** Whether the "+"/"−" badge was painted. */
  readonly badge: boolean;
}

/**
 * DIRTY-RECT (ADR-549 Phase 6) — the exact bands the next frame must clear so we
 * NEVER clear the whole backing store. A full-screen cross's bounding box is the
 * whole canvas, so a bbox clear would be no better than full-screen; instead we
 * clear the two THIN arm bands (one horizontal at `cy`, one vertical at `cx`) plus
 * the small aperture / badge boxes. Less fill ⇒ a far smaller window for the
 * `desynchronized` single-buffer present to beat the clear (the «trails» fix).
 *
 * Rects may exceed the canvas — the browser clamps `clearRect`, and the area
 * outside the drawable clip was never painted (clearing it is a no-op). So no
 * clamping is needed here; the bands are intentionally generous (± DIRTY_PAD).
 */
export function computeCrosshairClearRects(i: CrosshairClearInput): ClearRect[] {
  const reach = i.gap + i.armLength + DIRTY_PAD;
  const half = i.lineWidth / 2 + DIRTY_PAD;
  const rects: ClearRect[] = [
    // Horizontal arm band (spans both H arms, thin around cy).
    { x: i.cx - reach, y: i.cy - half, w: reach * 2, h: half * 2 },
    // Vertical arm band (spans both V arms, thin around cx).
    { x: i.cx - half, y: i.cy - reach, w: half * 2, h: reach * 2 },
  ];
  // Aperture box corners poke outside the bands ⇒ clear it explicitly.
  if (i.aperture > 0) {
    const s = i.aperture;
    const p = DIRTY_PAD + 1;
    rects.push({ x: i.cx - s / 2 - p, y: i.cy - s / 2 - p, w: s + p * 2, h: s + p * 2 });
  }
  // Badge sits top-right of the centre gap, away from the bands ⇒ clear it too.
  if (i.badge) {
    const off = badgeOffset(i.gap);
    const bx = i.cx + off;
    const by = i.cy - off - BADGE_PX;
    rects.push({ x: bx - DIRTY_PAD, y: by - DIRTY_PAD, w: BADGE_PX + DIRTY_PAD * 2, h: BADGE_PX + DIRTY_PAD * 2 });
  }
  return rects;
}

/**
 * setLineDash pattern for a given style (CSS px). Mirrors the DOM
 * `segmentBackground` dash/gap intent so solid/dashed/dotted/dash-dot look the
 * same on both render targets. Solid ⇒ empty array (continuous).
 */
export function dashPattern(style: CrosshairLineStyle): number[] {
  switch (style) {
    case 'dotted': return [1, 3];
    case 'dash-dot': return [8, 4, 1, 4];
    case 'dashed': return [6, 4];
    default: return [];
  }
}

/**
 * Static offset (CSS px) of the badge from the crosshair centre — mirrors the DOM
 * `computeBadgeOffset` (placed just outside the top-right of the centre gap).
 */
function badgeOffset(gap: number): number {
  return Math.max(gap, 4) + 2;
}

/**
 * Paint ONE crosshair frame. The context must already be transformed to CSS px
 * (origin pre-scaled by DPR) and CLEARED by the caller. Draws nothing extra when
 * the frame is hidden — the host clears + skips the call in that case.
 */
export function paintCrosshairFrame(ctx: CanvasRenderingContext2D, frame: CrosshairPaintFrame): void {
  const { cx, cy, clip, armLength, gap, lineWidth, color, opacity } = frame;

  ctx.save();
  // Clip to the drawable area so arms never paint over the rulers (2D); 3D area == whole canvas.
  ctx.beginPath();
  ctx.rect(clip.x, clip.y, clip.w, clip.h);
  ctx.clip();

  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dashPattern(frame.lineStyle));

  // Four arms: each stops `gap` px before the centre (the AutoCAD hole) and extends `armLength`.
  ctx.beginPath();
  // Horizontal arms (left + right) at y = cy
  ctx.moveTo(cx - gap - armLength, cy); ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + gap + armLength, cy);
  // Vertical arms (top + bottom) at x = cx
  ctx.moveTo(cx, cy - gap - armLength); ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + gap + armLength);
  ctx.stroke();

  // Centre square (aperture / APBOX) — solid 1px border, never dashed.
  if (frame.aperture.visible && frame.aperture.size > 0) {
    const s = frame.aperture.size;
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
  }

  // "+"/"−" selection badge — background box + glyph, top-right of the centre gap.
  if (frame.badge.visible) {
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const off = badgeOffset(gap);
    const bx = cx + off;
    const by = cy - off - BADGE_PX;
    ctx.fillStyle = frame.badge.backgroundColor;
    ctx.fillRect(bx, by, BADGE_PX, BADGE_PX);
    ctx.fillStyle = frame.badge.color;
    ctx.font = `bold ${BADGE_PX}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(frame.badge.text, bx + BADGE_PX / 2, by + BADGE_PX / 2 + 0.5);
  }

  ctx.restore();
}
