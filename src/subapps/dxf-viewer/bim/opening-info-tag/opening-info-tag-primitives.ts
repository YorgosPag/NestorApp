/**
 * ADR-612 — Opening Info Tag LAYOUT builder (frame-space SSoT).
 *
 * THE single source of truth for the tag's drawn geometry: the box outline, the
 * two internal dividers (one full-width horizontal, one half-height vertical) and
 * the 3 numeral labels — expressed in the tag's own **frame space** `(u, v)`
 * (`u` = along width, `v` = along height, +v up; canonical-mm from the box centre).
 *
 * Coordinate-system-agnostic on purpose: a caller supplies the frame→X map and the
 * SAME primitives drive BOTH backends —
 *   • the on-screen `OpeningInfoTagRenderer` maps `(u,v)` → screen and stamps, and
 *   • the vector/DXF export decomposer maps `(u,v)` → world.
 * Extracting the layout here removes the structural clone that would otherwise
 * exist between the on-screen renderer and the export decomposer (N.18).
 *
 * WORLD units throughout (Giorgio 2026-07-09): unlike the scale-bar there is no
 * annotative folding — `heightMm` / `textHeightMm` are already world canonical-mm.
 *
 * @see bim/opening-info-tag/opening-info-tag-geometry.ts — `computeOpeningInfoTagGeometry`
 * @see rendering/entities/opening-info-tag/stamp-opening-info-tag-primitives.ts — canvas backend
 * @see types/opening-info-tag.ts — the entity contract
 */

import type { OpeningInfoTagEntity, OpeningInfoTagFramePoint } from '../../types/opening-info-tag';
import { computeOpeningInfoTagGeometry } from './opening-info-tag-geometry';

/** One drawable element of an opening-info-tag, in frame space (backend-agnostic). */
export type OpeningInfoTagFramePrimitive =
  | { readonly kind: 'segment'; readonly a: OpeningInfoTagFramePoint; readonly b: OpeningInfoTagFramePoint }
  | {
      readonly kind: 'label';
      readonly at: OpeningInfoTagFramePoint;
      readonly text: string;
      /** Cap height in world canonical-mm; each backend folds it to its own unit. */
      readonly heightMm: number;
      readonly align: 'center';
    };

/**
 * Build the full frame-space primitive list for an opening-info-tag. Pure + idempotent.
 * Numeral cells are centred; empty strings are skipped (nothing to draw).
 */
export function buildOpeningInfoTagPrimitives(
  entity: OpeningInfoTagEntity,
): readonly OpeningInfoTagFramePrimitive[] {
  const geo = computeOpeningInfoTagGeometry(entity);
  const { halfWidth: hw, halfHeight: hh, textHeightMm } = geo;

  const prims: OpeningInfoTagFramePrimitive[] = [
    // ── Box outline (4 segments, CCW) ──
    seg(-hw, -hh, hw, -hh),
    seg(hw, -hh, hw, hh),
    seg(hw, hh, -hw, hh),
    seg(-hw, hh, -hw, -hh),
    // ── Horizontal divider at mid-height (full width) ──
    seg(-hw, 0, hw, 0),
    // ── Vertical divider in the BOTTOM half only (centre, v: -hh → 0) ──
    seg(0, -hh, 0, 0),
  ];

  // ── Numerals (one per cell centre; skip empties) ──
  for (const rect of geo.cells) {
    const text = openingInfoTagText(entity, rect.cell);
    if (text.length === 0) continue;
    prims.push({
      kind: 'label',
      at: rect.center,
      text,
      heightMm: textHeightMm,
      align: 'center',
    });
  }

  return prims;
}

/** A frame-space segment primitive from `(u1,v1)` to `(u2,v2)`. */
function seg(u1: number, v1: number, u2: number, v2: number): OpeningInfoTagFramePrimitive {
  return { kind: 'segment', a: { u: u1, v: v1 }, b: { u: u2, v: v2 } };
}

/** The numeral stored for a cell id (local mirror to keep this module import-light). */
function openingInfoTagText(
  entity: OpeningInfoTagEntity,
  cell: 'top' | 'bottomLeft' | 'bottomRight',
): string {
  switch (cell) {
    case 'top':
      return entity.topText;
    case 'bottomLeft':
      return entity.bottomLeftText;
    case 'bottomRight':
      return entity.bottomRightText;
  }
}
