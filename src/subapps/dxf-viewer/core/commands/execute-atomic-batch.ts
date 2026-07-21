/**
 * execute-atomic-batch — SSoT για το «πολλά commands, ΕΝΑ undo» (ADR-539 Φ4b / ADR-678 Φ3).
 *
 * Πολλά paint/edit commands (per-face, cross-entity, import) πρέπει να αναιρούνται με **ΕΝΑ**
 * Ctrl+Z (Cinema 4D / Revit «paint on multiple faces»). Το ίδιο 3-πτυχο idiom (0 → no-op·
 * 1 → σκέτο command, μηδέν composite overhead· N → `CompositeCommand`) ήταν αντιγραμμένο σε
 * `bim-3d/ui/apply-face-appearance.ts` και `io/mesh3d-material-import/import-c4d-materials.ts` —
 * εδώ ζει μία φορά ώστε κάθε νέος καταναλωτής (π.χ. batch import) να μην κάνει τρίτο αντίγραφο.
 *
 * @see core/commands/CompositeCommand.ts — το atomic undo group
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { getGlobalCommandHistory } from './index';
import { CompositeCommand } from './CompositeCommand';
import type { ICommand } from './interfaces';

/**
 * Εκτελεί μια λίστα commands ως ΕΝΑ atomic undo step μέσω του global command history:
 * `0` → no-op· `1` → σκέτο command (μηδέν composite overhead, ίδια συμπεριφορά με μονό execute)·
 * `N` → `CompositeCommand` (ένα Ctrl+Z αναιρεί ΟΛΑ μαζί, σε reverse order).
 */
export function executeAsAtomicBatch(children: readonly ICommand[]): void {
  if (children.length === 0) return;
  getGlobalCommandHistory().execute(
    children.length === 1 ? children[0] : new CompositeCommand([...children]),
  );
}
