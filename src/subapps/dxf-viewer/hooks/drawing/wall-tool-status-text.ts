/**
 * ADR-363 — Wall Tool status-text resolver (i18n keys for caller-resolved translation).
 *
 * Pure function extracted from `useWallTool.getStatusText` for N.7.1 (≤500 lines).
 * Returns the i18n key for the current state's prompt; the caller (ribbon / status bar)
 * runs `t()`. No hardcoded UI strings — only i18n keys (N.11 exempt).
 *
 * @see ./useWallTool.ts
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import type { WallToolState } from './wall-tool-types';

export function resolveWallToolStatusKey(s: WallToolState): string {
  // ADR-419 — in-region prompts ανά τρόπο (4 γραμμές / κλικ μέσα / πλαίσιο).
  if (s.placementMode === 'in-region') {
    if (s.regionMethod === 'inside') return 'tools.wall.statusRegionInsidePick';
    if (s.regionMethod === 'box') return 'tools.wall.statusRegionBoxPick';
    return s.regionPicks.length > 0
      ? 'tools.wall.statusRegionMore'
      : 'tools.wall.statusRegionLinesPick';
  }
  // ADR-363 «Τοίχος από περίγραμμα» — box-select prompt.
  if (s.placementMode === 'outer-perimeter') {
    return 'tools.wall.statusPerimeterPick';
  }
  // ADR-363 Phase 1J — on-entity prompts.
  if (s.placementMode === 'on-entity') {
    if (s.phase === 'awaitingStart') return 'tools.wall.statusPickEntity';
    if (s.phase === 'awaitingSide') return 'tools.wall.statusPickSide';
    return '';
  }
  // ADR-565 §12 Φ1.x — arc draw-variant-specific prompts (Revit Draw gallery).
  const curvedCenterEnds = s.kind === 'curved' && s.arcVariant === 'center-ends';
  const curvedTangent = s.kind === 'curved' && s.arcVariant === 'tangent';
  switch (s.phase) {
    case 'awaitingStart':
      // «κέντρο-άκρα» — το 1ο κλικ είναι το ΚΕΝΤΡΟ του τόξου.
      return curvedCenterEnds ? 'tools.wall.statusArcCenter' : 'tools.wall.statusStart';
    case 'awaitingEnd':
      if (curvedCenterEnds) return 'tools.wall.statusArcRadiusStart'; // αρχή πάνω στον κύκλο (ακτίνα)
      if (curvedTangent) return 'tools.wall.statusArcTangentEnd';     // 2-click εφαπτομενικό: τέλος
      return s.kind === 'curved' ? 'tools.wall.statusCurveEnd' : 'tools.wall.statusEnd';
    case 'awaitingAlignment':
      return 'tools.wall.statusAlignment';
    case 'awaitingArcRadiusPoint':
      // «κέντρο-άκρα» — το 3ο κλικ ορίζει τη γωνία (τελικό άκρο) πάνω στον κύκλο.
      return 'tools.wall.statusArcCenterEnd';
    case 'awaitingCurveControl':
      // «αρχή-τέλος-ακτίνα» — πληκτρολόγησε ακτίνα ή κλικ· «3-σημείων» — σημείο στο τόξο.
      return s.arcVariant === 'start-end-radius'
        ? 'tools.wall.statusArcRadiusValue'
        : 'tools.wall.statusArcThrough';
    case 'awaitingNextVertex':
      return 'tools.wall.statusPolyNext';
    default:
      return '';
  }
}
