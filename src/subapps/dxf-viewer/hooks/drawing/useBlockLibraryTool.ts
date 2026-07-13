/**
 * Block Library — single-click placement tool (Milestone 1).
 *
 * ADR-600: το invariant placement FSM ζει στο `createSingleClickPlacementTool`· εδώ είναι μόνο
 * το thin per-entity config. Μοτίβο ίδιο με το `useFurnitureTool` (ADR-410), αλλά ΧΩΡΙΣ extra
 * tool-state: το «ποιο block» δεν είναι επιλογή του tool — το γράφει το palette («Τα Blocks μου»)
 * στο `block-library-selection-store` (SSoT) και το tool το διαβάζει σε EVENT-TIME (κλικ/ghost),
 * ώστε να μη χρειάζεται React re-render για να αλλάξει ο ghost (ADR-040).
 *
 * FSM: idle → awaitingPosition → committed → awaitingPosition (continuous). ESC reset.
 * Το commit το κάνει ο καλών μέσω `onBlockCreated` → `addBlockToScene` (undoable SSoT).
 *
 * @see ./create-single-click-placement-tool.ts — invariant FSM (ADR-600)
 * @see ../../bim/block-library/block-library-selection-store.ts — «ποιο block» SSoT
 * @see ../../bim/block-library/place-block-from-library.ts — buildBlockEntityFromDef
 */

import type { BlockEntity } from '../../types/entities';
import { getSessionBlockDef } from '../../bim/block-library/block-library-registry';
import { getSelectedBlockName } from '../../bim/block-library/block-library-selection-store';
import {
  buildBlockEntityFromDef,
  type BlockPlacementParams,
} from '../../bim/block-library/place-block-from-library';
import { computeBlockFootprint } from '../../bim/block-library/block-library-footprint';
import type { BlockLibraryParamOverrides } from '../../bim/block-library/block-library-types';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
  type CorePlacementState,
} from './create-single-click-placement-tool';

/** Blocks είναι αυτο-συνεπή στις scene units — καμία mm→scene μετατροπή (σε αντίθεση με furniture). */
type BlockSceneUnits = 'mm';

/** TParams: placement + το επιλεγμένο block name (resolved event-time από το selection store). */
interface BlockToolParams extends BlockPlacementParams {
  readonly blockName: string;
}

export interface UseBlockLibraryToolOptions {
  readonly onBlockCreated?: (entity: BlockEntity) => void;
  readonly currentLevelId?: string;
}

export type UseBlockLibraryToolResult = CorePlacementResult<
  CorePlacementState<BlockLibraryParamOverrides>,
  BlockLibraryParamOverrides
>;

const useBlockPlacement = createSingleClickPlacementTool<
  BlockEntity,
  BlockToolParams,
  BlockLibraryParamOverrides,
  Record<string, never>,
  Record<string, never>,
  BlockSceneUnits
>({
  defaultSceneUnits: 'mm',
  buildParams: (clickPoint, overrides): BlockToolParams => ({
    position: { x: clickPoint.x, y: clickPoint.y },
    scale: overrides.scale != null ? { x: overrides.scale, y: overrides.scale } : undefined,
    rotation: overrides.rotation,
    layerId: '0',
    blockName: getSelectedBlockName() ?? '',
  }),
  buildEntity: (params) => {
    const def = getSessionBlockDef(params.blockName);
    if (!def) return { ok: false, hardErrors: ['tools.blockLibrary.errorNoSelection'] };
    return { ok: true, entity: buildBlockEntityFromDef(def, params) };
  },
  computeFootprint: (params) => {
    const def = getSessionBlockDef(params.blockName);
    return def ? computeBlockFootprint(def, params) : [];
  },
  getStatusText: (s) => (s.phase === 'awaitingPosition' ? 'tools.blockLibrary.statusPosition' : ''),
});

export function useBlockLibraryTool(
  options: UseBlockLibraryToolOptions = {},
): UseBlockLibraryToolResult {
  return useBlockPlacement({
    onCreated: options.onBlockCreated,
    currentLevelId: options.currentLevelId,
  });
}
