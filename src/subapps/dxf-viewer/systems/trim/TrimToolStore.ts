/**
 * TRIM TOOL STORE — ADR-350
 *
 * Module-level pub/sub store για το Trim command state machine. Zero React state.
 *
 * Το state machine, τα mode/edgeMode/projectMode toggles, το fence-drag preview, το
 * warning aggregation και τα closure registries ζουν ΟΛΑ στο κοινό `createEdgeToolStore`
 * SSoT — αυτό το αρχείο κρατά ΜΟΝΟ ό,τι είναι πραγματικά trim-specific: τα preview/
 * warning types του και το `eraseArmed` (eRase keyword — δεν έχει αντίστοιχο στο EXTEND).
 *
 * State machine (Q1/Q2 defaults: quick mode, no extend, UCS project):
 *   IDLE → PICKING                              (quick mode)
 *   IDLE → SELECTING_EDGES → PICKING             (standard mode)
 *   PICKING ↔ FENCE / CROSSING                   (drag selection sub-modes)
 *
 * @see ../../stores/createEdgeToolStore.ts — το κοινό edge-tool SSoT
 * @see ../extend/ExtendToolStore.ts — το αντίστροφο sibling
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §State Machine
 */

import {
  createEdgeToolStore,
  type EdgeToolBaseState,
} from '../../stores/createEdgeToolStore';
import {
  EMPTY_TRIM_WARNINGS,
  type TrimMultiPreview,
  type TrimPreviewGeom,
  type TrimWarningAggregator,
} from './trim-types';

/** TRIM-only state — δεν υπάρχει eRase keyword στο EXTEND. */
interface TrimExtraState {
  /** Το επόμενο κλικ διαγράφει το target αντί να το κόψει (eRase keyword armed). */
  readonly eraseArmed: boolean;
}

/**
 * `edgeIds` = τα cutting edges. Empty array σε Quick mode = «όλες οι ορατές οντότητες».
 */
export type TrimToolState = EdgeToolBaseState<
  TrimPreviewGeom,
  TrimMultiPreview,
  TrimWarningAggregator
> &
  TrimExtraState;

const base = createEdgeToolStore<
  TrimPreviewGeom,
  TrimMultiPreview,
  TrimWarningAggregator,
  TrimExtraState
>({
  emptyWarnings: EMPTY_TRIM_WARNINGS,
  extraInitial: { eraseArmed: false },
});

export const TrimToolStore = {
  ...base,

  setEraseArmed(armed: boolean): void {
    base.patch({ eraseArmed: armed });
  },
} as const;
