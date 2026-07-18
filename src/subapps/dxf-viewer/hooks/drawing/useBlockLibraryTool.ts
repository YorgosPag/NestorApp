/**
 * Block Library — single-click placement tool (Milestone 1).
 *
 * ADR-600: το invariant placement FSM ζει στο `createSingleClickPlacementTool`· εδώ είναι μόνο
 * το thin per-entity config. Μοτίβο ίδιο με το `useFurnitureTool` (ADR-410), αλλά ΧΩΡΙΣ extra
 * tool-state: το «ποιο block» δεν είναι επιλογή του tool — το γράφει το palette («Τα Blocks μου»)
 * στο `block-library-selection-store` (SSoT) και το tool το διαβάζει σε EVENT-TIME (κλικ/ghost),
 * ώστε να μη χρειάζεται React re-render για να αλλάξει ο ghost (ADR-040).
 *
 * FSM: idle → awaitingPosition → awaitingRotation → committed → awaitingPosition (continuous,
 * ADR-652 §M7 2-click place→rotate — mirror κολώνας/πεδίλου, ADR-514 Φ6d). ESC reset.
 * Το commit το κάνει ο καλών μέσω `onBlockCreated` → `addBlockToScene` (undoable SSoT).
 *
 * M1.5: το `useExtension` δημοσιεύει το tool handle στο `blockLibraryToolBridgeStore` ώστε το
 * contextual ribbon tab να ρυθμίζει rotation/scale της ΕΠΟΜΕΝΗΣ τοποθέτησης (ΑΝΤΙΣΤΡΟΦΗ φορά
 * από το selection store: εκεί palette→tool, εδώ tool→ribbon).
 *
 * @see ./create-single-click-placement-tool.ts — invariant FSM (ADR-600)
 * @see ../../bim/block-library/block-library-selection-store.ts — «ποιο block» SSoT
 * @see ../../bim/block-library/place-block-from-library.ts — buildBlockEntityFromDef
 * @see ../../ui/ribbon/hooks/bridge/block-library-tool-bridge-store.ts — tool → ribbon (M1.5)
 */

import { useEffect } from 'react';

import type { BlockEntity } from '../../types/entities';
import { getSessionBlockDef } from '../../bim/block-library/block-library-registry';
import { getSelectedBlockName } from '../../bim/block-library/block-library-selection-store';
import {
  buildBlockEntityFromDef,
  buildBlockPlacementParams,
  type BlockPlacementParams,
} from '../../bim/block-library/place-block-from-library';
import { computeBlockFootprint } from '../../bim/block-library/block-library-footprint';
import type { BlockLibraryParamOverrides } from '../../bim/block-library/block-library-types';
import {
  createSingleClickPlacementTool,
  type CorePlacementResult,
  type CorePlacementState,
} from './create-single-click-placement-tool';
import { blockLibraryToolBridgeStore } from '../../ui/ribbon/hooks/bridge/block-library-tool-bridge-store';

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
  // ADR-652 §M7 — extracted ΚΟΙΝΟΣ mapper (preview ≡ commit, N.18): ο ίδιος
  // `buildBlockPlacementParams` τροφοδοτεί ΚΑΙ το ghost (`generateBlockLibraryPreview`).
  buildParams: (clickPoint, overrides): BlockToolParams => ({
    ...buildBlockPlacementParams(clickPoint, overrides, 'mm'),
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
  getStatusText: (s) => {
    if (s.phase === 'awaitingRotation') return 'tools.blockLibrary.statusRotation';
    return s.phase === 'awaitingPosition' ? 'tools.blockLibrary.statusPosition' : '';
  },
  // ADR-652 §M7 place+rotate — 2ο κλικ ορίζει τη γωνία (mirror κολώνας/πεδίλου, ADR-514 Φ6d):
  // το τόξο φοράς + η πορτοκαλί γραμμή έρχονται ΔΩΡΕΑΝ από το κοινό `drawing-hover-overlays.ts`
  // (ίδιο `PlacementRotationStore` lock) — καμία επιπλέον state εδώ.
  placeThenRotate: {
    withRotation: (overrides, deg) => ({ ...overrides, rotation: deg }),
  },
  // ADR-652 M1.5 — δημοσίευσε το handle στο ribbon (tool → contextual tab). Καμία extra tool
  // state: ο πυρήνας (ADR-600) κατέχει ήδη τα `overrides` + τον `setParamOverrides` setter,
  // άρα ο bridge γράφει ΑΠΕΥΘΕΙΑΣ στον SSoT setter — κανένα δεύτερο αντίγραφο του transform.
  useExtension: ({ state, isActive, setParamOverrides }) => {
    useEffect(() => {
      blockLibraryToolBridgeStore.set({ isActive, overrides: state.overrides, setParamOverrides });
      // Καθάρισε ΜΟΝΟ αν το store κρατά ακόμα ΤΟ ΔΙΚΟ ΜΑΣ handle (ο `setParamOverrides` είναι
      // stable ανά tool instance → ασφαλές identity key· mirror του furniture tool).
      return () => {
        if (blockLibraryToolBridgeStore.get()?.setParamOverrides === setParamOverrides) {
          blockLibraryToolBridgeStore.set(null);
        }
      };
    }, [state.overrides, isActive, setParamOverrides]);
    return {};
  },
});

export function useBlockLibraryTool(
  options: UseBlockLibraryToolOptions = {},
): UseBlockLibraryToolResult {
  return useBlockPlacement({
    onCreated: options.onBlockCreated,
    currentLevelId: options.currentLevelId,
  });
}
