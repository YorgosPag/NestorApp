/**
 * ADR-444 §Icons — action badges for the MEP auto-design triad (data, SRP split).
 *
 * A badge sits bottom-right over the subject, which is knocked out underneath by a
 * mask circle ({@link MEP_BADGE_CUTOUT}) so the two never tangle — the Fluent /
 * Material "badge cut-out" treatment. Same idea as the ADR-443 structural method
 * badge, generalised to ACTIONS:
 *
 *   generate → ✦ sparkle   (auto-design / generative — neutral, inherits currentColor)
 *   accept   → ✓ check     (Revit «Finish», Office «Accept» — success colour token)
 *   reject   → ✗ cross     (Revit «Cancel», Office «Reject» — danger colour token)
 *
 * Shape alone already separates the three (colour-blind safe); colour is a second,
 * redundant cue. Colours are ribbon tokens (`--ribbon-icon-accept|reject`), never hex.
 */

import * as React from 'react';
import type { MepIconBadge } from './mep-icon-tokens';

/** The knock-out circle under every badge (icon viewBox units). */
export const MEP_BADGE_CUTOUT = { cx: 18, cy: 18, r: 6.6 } as const;

const BADGE_STROKE = 2.2;

export const MEP_BADGE_FRAGMENTS: Record<MepIconBadge, React.ReactNode> = {
  generate: (
    <path
      d="M18 12.6 Q18.7 17.3 23.4 18 Q18.7 18.7 18 23.4 Q17.3 18.7 12.6 18 Q17.3 17.3 18 12.6 Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  accept: (
    <polyline
      className="dxf-ribbon-icon-badge-accept"
      points="13.6,18.2 16.6,21.2 22.4,15"
      strokeWidth={BADGE_STROKE}
    />
  ),
  reject: (
    <g className="dxf-ribbon-icon-badge-reject" strokeWidth={BADGE_STROKE}>
      <line x1="14.4" y1="14.4" x2="21.6" y2="21.6" />
      <line x1="21.6" y1="14.4" x2="14.4" y2="21.6" />
    </g>
  ),
};
