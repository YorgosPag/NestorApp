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

/** On-screen ⊙ diameter (px) — constant at any zoom, in 2D and 3D alike. */
export const CLASH_MARKER_PX = 16;
export const CLASH_MARKER_HALF = CLASH_MARKER_PX / 2;

export interface ClashMarkerGlyphProps {
  readonly severity: ClashSeverity;
  /** Clearance (soft) clash → dashed ring; hard → solid. */
  readonly soft: boolean;
}

export function ClashMarkerGlyph({ severity, soft }: ClashMarkerGlyphProps): React.ReactElement {
  const color = CLASH_SEVERITY_COLOR[severity];
  return (
    <svg width={CLASH_MARKER_PX} height={CLASH_MARKER_PX} viewBox="0 0 16 16" className="pointer-events-none block">
      <circle
        cx="8" cy="8" r="6"
        fill={`${color}33`}
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={soft ? '3 2' : undefined}
      />
      <path d="M8 2v12M2 8h12" stroke={color} strokeWidth="1" />
    </svg>
  );
}
