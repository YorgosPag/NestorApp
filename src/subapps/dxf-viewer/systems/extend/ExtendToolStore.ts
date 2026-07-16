/**
 * EXTEND TOOL STORE — ADR-353
 *
 * Module-level pub/sub store για το Extend command state machine. Zero React state.
 *
 * Το state machine, τα mode/edgeMode/projectMode toggles, το fence-drag preview, το
 * warning aggregation και τα closure registries ζουν ΟΛΑ στο κοινό `createEdgeToolStore`
 * SSoT — αυτό το αρχείο κρατά ΜΟΝΟ ό,τι είναι πραγματικά extend-specific: τα preview/
 * warning types του.
 *
 * State machine (Quick mode default, EDGEMODE=0, UCS project):
 *   IDLE → PICKING                              (quick mode)
 *   IDLE → SELECTING_EDGES → PICKING             (standard mode)
 *   PICKING ↔ FENCE / CROSSING                   (drag selection sub-modes)
 *
 * @see ../../stores/createEdgeToolStore.ts — το κοινό edge-tool SSoT
 * @see ../trim/TrimToolStore.ts — το αντίστροφο sibling
 * @see docs/centralized-systems/reference/adrs/ADR-353-extend-command.md §State Machine
 */

import {
  createEdgeToolStore,
  type EdgeToolBaseState,
} from '../../stores/createEdgeToolStore';
import {
  EMPTY_EXTEND_WARNINGS,
  type ExtendMultiPreview,
  type ExtendPreviewGeom,
  type ExtendWarningAggregator,
} from './extend-types';

/**
 * `edgeIds` = τα boundary edges. Empty array σε Quick mode = «όλες οι ορατές οντότητες».
 */
export type ExtendToolState = EdgeToolBaseState<
  ExtendPreviewGeom,
  ExtendMultiPreview,
  ExtendWarningAggregator
>;

export const ExtendToolStore = createEdgeToolStore<
  ExtendPreviewGeom,
  ExtendMultiPreview,
  ExtendWarningAggregator
>({
  emptyWarnings: EMPTY_EXTEND_WARNINGS,
  extraInitial: {},
});
