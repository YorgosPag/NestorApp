'use client';

/**
 * ADR-435 Slice 1b — ClashMarkerGlyph: the SINGLE source of truth for the clash
 * marker visual (a ring + crosshair ⊙). Used by BOTH the 2D overlay and the 3D
 * camera-projected overlay, so the two are byte-identical — there is no second
 * shape definition. Severity colour comes from the shared SSoT palette; a clearance
 * (soft) clash gets a dashed ring.
 *
 * Pure presentational SVG, no positioning — the {@link ClashMarkerLayer} places it.
 *
 * @see ../../../systems/coordination/clash-severity-color.ts
 */

import React from 'react';
import { CLASH_SEVERITY_COLOR } from '../../../systems/coordination/clash-severity-color';
import type { ClashSeverity } from '../../../systems/coordination/clash-types';
import { UI_COLORS } from '../../../config/color-config';

/**
 * On-screen ⊙ diameter (px) — constant at any zoom, in 2D and 3D alike, and **the same whether or
 * not the marker is selected**. The layer centres every glyph by this half-size, so a selected
 * marker grows via `overflow: visible` (drawing outside its 16×16 box around the unchanged (8,8)
 * centre) instead of by changing its box. Growing the box would shift the centre and make the
 * selected marker drift off the very point it is pointing at.
 */
export const CLASH_MARKER_PX = 16;
export const CLASH_MARKER_HALF = CLASH_MARKER_PX / 2;

export interface ClashMarkerGlyphProps {
  readonly severity: ClashSeverity;
  /** Clearance (soft) clash → dashed ring; hard → solid. */
  readonly soft: boolean;
  /**
   * The one the user just clicked in the report: bigger, plus a halo in the app's selection
   * colour. Optional and defaulting to `false` — the clash overlay has no row selection and is
   * unaffected. Severity keeps its own colour underneath, because «which finding am I on» and
   * «how bad is it» are two questions and the marker must still answer both.
   */
  readonly selected?: boolean;
}

export function ClashMarkerGlyph({ severity, soft, selected = false }: ClashMarkerGlyphProps): React.ReactElement {
  const color = CLASH_SEVERITY_COLOR[severity];
  return (
    <svg
      width={CLASH_MARKER_PX} height={CLASH_MARKER_PX} viewBox="0 0 16 16"
      className="pointer-events-none block overflow-visible"
    >
      {selected && (
        // Halo OUTSIDE the box (r=11 > the 8 half-extent) — visible only thanks to overflow.
        <circle cx="8" cy="8" r="11" fill="none" stroke={UI_COLORS.SELECTION_HIGHLIGHT} strokeWidth="2" />
      )}
      <circle
        cx="8" cy="8" r={selected ? 8.5 : 6}
        fill={`${color}${selected ? '66' : '33'}`}
        stroke={color}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={soft ? '3 2' : undefined}
      />
      <path d="M8 2v12M2 8h12" stroke={color} strokeWidth="1" />
    </svg>
  );
}
