/**
 * ADR-363 Phase 4 — Column Tool status-text resolver (pure, SSoT).
 *
 * Extracted από `useColumnTool` (N.7.1 file-size split). Maps the column FSM
 * state → i18n key για status-bar / Dynamic Input prompt. Pure function: zero
 * React/store dependencies, καθιστά την λογική testable σε απομόνωση.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4
 */

import type { ColumnToolState } from './useColumnTool';
import type { PolygonSketchPhase } from './use-polygon-sketch-chain';

/**
 * Επιστρέφει το i18n key του status prompt για την τρέχουσα κατάσταση του
 * εργαλείου κολώνας (caller-resolved translation). Empty string ⇒ no prompt.
 *
 * `sketchPhase` — ADR-363 §column-polygon-sketch: όταν placementMode='polygon', το
 * πραγματικό FSM ζει στο κοινό vertex-chain primitive· ο caller περνά το chain phase.
 */
export function resolveColumnStatusTextKey(
  s: ColumnToolState,
  sketchPhase?: PolygonSketchPhase,
): string {
  if (s.phase === 'idle') return '';
  // ADR-363 §column-polygon-sketch — σχεδιασμένο πολύγωνο (vertex chain, όπως slab).
  if (s.placementMode === 'polygon') {
    return sketchPhase === 'awaitingNextVertex'
      ? 'tools.column.statusPolygonNextVertex'
      : 'tools.column.statusPolygonFirstVertex';
  }
  // ADR-363 Φάση 3 — outer-perimeter prompt (box-select τις παρειές).
  if (s.placementMode === 'outer-perimeter') return 'tools.column.statusPerimeterPick';
  // ADR-363 Φάση 3c — discrete-perimeter prompt (box-select· αυτόματη ταξινόμηση).
  if (s.placementMode === 'discrete-perimeter') return 'tools.column.statusDiscretePerimeterPick';
  // ADR-419 — in-region prompt ανά τρόπο (4 γραμμές / κλικ μέσα / πλαίσιο).
  if (s.placementMode === 'in-region') {
    if (s.regionMethod === 'inside') return 'tools.column.statusRegionInsidePick';
    if (s.regionMethod === 'box') return 'tools.column.statusRegionBoxPick';
    return 'tools.column.statusRegionLinesPick';
  }
  return s.phase === 'awaitingPosition' ? 'tools.column.statusPosition' : '';
}
