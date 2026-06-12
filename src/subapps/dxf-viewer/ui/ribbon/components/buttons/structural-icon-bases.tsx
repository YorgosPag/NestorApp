/**
 * ADR-443 — Structural tool icon BASE fragments (data, SRP split).
 *
 * One Revit-style plan-view symbol per load-bearing family. Composed with a
 * bottom-right "creation method" badge by `StructuralToolIcon.tsx`. Five bases ×
 * ten methods = 22 distinct ribbon icons from 5+10 fragment defs (no duplication).
 *
 * Authoring rules: viewBox 0 0 24 24, stroke=currentColor (inherited from the
 * wrapping <svg>), no fills except solid centre/marker dots. Keep the symbol
 * readable on its own; the method badge lives in the bottom-right (~x14–22).
 */

import * as React from 'react';

export type StructuralBase =
  | 'wall'
  | 'column'
  | 'beam'
  | 'foundation-pad'
  | 'foundation-strip';

export const STRUCTURAL_BASE_FRAGMENTS: Record<StructuralBase, React.ReactNode> = {
  // Wall (plan): two parallel faces = wall thickness, open ends.
  wall: (
    <>
      <line x1="2" y1="9" x2="22" y2="9" />
      <line x1="2" y1="15" x2="22" y2="15" />
    </>
  ),
  // Column (plan): centred square section + centre mark.
  column: (
    <>
      <rect x="7.5" y="7.5" width="9" height="9" rx="0.5" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  // Beam: rectangle outline + dashed centreline (member axis).
  beam: (
    <>
      <rect x="2" y="9" width="20" height="6" rx="0.5" />
      <line x1="2" y1="12" x2="22" y2="12" strokeDasharray="3,2" />
    </>
  ),
  // Isolated footing (pad): outer footing square + inner column square.
  'foundation-pad': (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
      <rect x="8" y="8" width="8" height="8" rx="0.5" />
    </>
  ),
  // Strip footing: wide footing band (two outer faces) + dashed beam centreline.
  'foundation-strip': (
    <>
      <line x1="2" y1="6" x2="22" y2="6" />
      <line x1="2" y1="18" x2="22" y2="18" />
      <line x1="2" y1="12" x2="22" y2="12" strokeDasharray="3,2" />
    </>
  ),
};
