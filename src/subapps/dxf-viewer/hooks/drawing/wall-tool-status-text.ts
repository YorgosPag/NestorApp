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
  switch (s.phase) {
    case 'awaitingStart':
      return 'tools.wall.statusStart';
    case 'awaitingEnd':
      return s.kind === 'curved'
        ? 'tools.wall.statusCurveEnd'
        : 'tools.wall.statusEnd';
    case 'awaitingAlignment':
      return 'tools.wall.statusAlignment';
    case 'awaitingCurveControl':
      return 'tools.wall.statusCurveControl';
    case 'awaitingNextVertex':
      return 'tools.wall.statusPolyNext';
    default:
      return '';
  }
}
