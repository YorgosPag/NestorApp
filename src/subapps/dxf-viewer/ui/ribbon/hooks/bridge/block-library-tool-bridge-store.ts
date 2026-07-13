/**
 * ADR-652 (M1.5) — Bridge store: Block Library placement tool → contextual ribbon tab.
 *
 * ΑΝΤΙΣΤΡΟΦΗ φορά από το `block-library-selection-store` («ποιο block»: palette → tool).
 * Εδώ το ΕΡΓΑΛΕΙΟ δημοσιεύει το handle του, ώστε το ribbon να διαβάζει/γράφει τα placement
 * overrides (rotation/scale) του ΕΠΟΜΕΝΟΥ κλικ.
 *
 * ⚠️ ΧΩΡΙΣ asset picker — σε αντίθεση με furniture / floorplan-symbol / mep-fixture-library.
 * Το «ποιο block» ΔΕΝ ζει εδώ: το κατέχει το palette («Τα Blocks μου») μέσω του selection
 * store (ADR-652 SSoT) και το tool το διαβάζει σε event-time. Άρα το handle υλοποιεί μόνο
 * το numeric-override μισό του `ToolHandleLike` — ο πρώτος numeric-only καταναλωτής του
 * `useToolHandleBridge` (ο picker εκεί είναι πλέον προαιρετικός· N.18: ΟΧΙ sibling clone
 * του furniture bridge).
 *
 * @see ../ribbon-tool-handle-bridge-shared.ts — useToolHandleBridge (picker προαιρετικός)
 * @see ../../../../bim/block-library/block-library-selection-store.ts — «ποιο block» SSoT
 */

import { createToolBridgeStore } from '../../../../stores/createToolBridgeStore';
import type { BlockLibraryParamOverrides } from '../../../../bim/block-library/block-library-types';

/** Το handle που δημοσιεύει το `useBlockLibraryTool.useExtension` στο ribbon. */
export interface BlockLibraryToolBridgeHandle {
  readonly isActive: boolean;
  /** Τα τρέχοντα placement overrides (rotation σε ΜΟΙΡΕΣ, scale ομοιόμορφο). */
  readonly overrides: BlockLibraryParamOverrides;
  setParamOverrides(overrides: BlockLibraryParamOverrides): void;
}

export const blockLibraryToolBridgeStore = createToolBridgeStore<BlockLibraryToolBridgeHandle>();
