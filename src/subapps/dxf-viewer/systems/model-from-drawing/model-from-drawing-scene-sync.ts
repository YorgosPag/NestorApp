/**
 * ADR-911 — ο βοηθός «Μοντέλο από το σχέδιο» **ακολουθεί τη σκηνή**: ό,τι δείχνει είναι συνάρτηση
 * (σκηνή, αποφάσεις του ανθρώπου), και ξαναϋπολογίζεται όταν αλλάξει η σκηνή — από αναίρεση, επανάληψη,
 * χειροκίνητη επεξεργασία ή αλλαγή ορόφου — όχι μόνο όταν αλλάξει ο όροφος.
 *
 * Πρότυπο των μεγάλων: στο Revit το `DocumentChanged` πυροδοτείται και για `TransactionUndone` /
 * `TransactionRedone` (η αναίρεση ΕΙΝΑΙ αλλαγή του εγγράφου)· στο Figma το `documentchange` που δεν
 * πυροδοτείται σε undo αναφέρεται ως σφάλμα. Πέρα από αυτά, εδώ:
 *   1. **Early cutoff κατά ταυτότητα** — κάθε πρόταση κρατά τη `SceneBasis` της· ξαναϋπολογίζεται ΜΟΝΟ η
 *      πρόταση που η βάση της δεν είναι πια η ζωντανή. Η δική μας έγκριση (που ξαναϋπολογίζει σύγχρονα)
 *      δεν πληρώνει δεύτερο υπολογισμό.
 *   2. **Συγχώνευση** — πολλές αλλαγές στο ίδιο tick ⇒ ΕΝΑΣ επανυπολογισμός (`createMicrotaskCoalescer`, ADR-488).
 *   3. **Οι αποφάσεις μένουν** — επιβεβαιωμένες ομάδες πάχους και αμφίσημα επιβιώνουν της αναίρεσης.
 *   4. **Καμία ειδοποίηση δεν λέει πια ψέματα** — «Δημιουργήθηκαν 44 τοίχοι. Ctrl+Z για αναίρεση» αφορά ΜΙΑ
 *      συναλλαγή: αποσύρεται όταν η πρόταση ξαναϋπολογίζεται επειδή κινήθηκε το ιστορικό ή άλλαξε ο όροφος
 *      (το ανάλογο του `Operation` του Revit). Αλλαγή χωρίς ιστορικό (π.χ. ασύγχρονη εγγραφή) την κρατά.
 *
 * Zero React. Ο host δίνει τα σήματα (σκηνή · ιστορικό · όροφος) και τις εξαρτήσεις, ΤΗ ΣΤΙΓΜΗ του τρεξίματος.
 *
 * @see ./model-from-drawing-live.ts (`SceneBasis` — η ταυτότητα της σκηνής μιας πρότασης)
 * @see ../../app/ModelFromDrawingHost.tsx (ο host που συνδέει τα σήματα)
 */

import { createMicrotaskCoalescer } from '../../hooks/proactive-coalescer';
import type { WallSceneAccessor } from '../../bim/walls/add-wall-to-scene';
import { isSceneBasisCurrent } from './model-from-drawing-live';
import { modelFromDrawingStore, type ModelFromDrawingState } from './model-from-drawing-store';
import { modelFromDrawingSession, type ModelFromDrawingDeps } from './model-from-drawing-session';
import { modelFromDrawingOpeningsSession, type OpeningSessionDeps } from './model-from-drawing-openings-session';

/** Οι εξαρτήσεις και των δύο ελεγκτών, διαβασμένες ΤΩΡΑ. */
export interface AssistantSceneDeps {
  readonly walls: ModelFromDrawingDeps;
  readonly openings: OpeningSessionDeps;
}

/** Τα σήματα που δίνει ο host. */
export interface AssistantSceneSync {
  /** Η σκηνή άλλαξε, ή ο ενεργός όροφος. */
  readonly sceneChanged: () => void;
  /** Κινήθηκε το ιστορικό αναίρεσης (εκτέλεση · αναίρεση · επανάληψη). */
  readonly historyMoved: () => void;
}

/** Ο όροφος της πρότασης δεν είναι πια ο ενεργός. */
function levelMoved(state: ModelFromDrawingState, accessor: WallSceneAccessor): boolean {
  const basis = state.wallBasis ?? state.openingBasis;
  return basis !== null && basis.levelId !== accessor.currentLevelId;
}

/**
 * Ξαναϋπολογίζει ΜΟΝΟ ό,τι έγινε μπαγιάτικο. `historyMoved`: η αλλαγή ήρθε (και) από το ιστορικό ⇒ η
 * ειδοποίηση της τελευταίας πράξης αποσύρεται. Επιστρέφει `true` ⇔ ξαναϋπολογίστηκε κάτι.
 */
export function syncAssistantToScene(deps: AssistantSceneDeps, historyMoved: boolean): boolean {
  const state = modelFromDrawingStore.get();
  if (state.phase !== 'review') return false;
  const wallsStale = state.proposal !== null && !isSceneBasisCurrent(state.wallBasis, deps.walls.accessor);
  const openingsStale = state.openingColorHex !== null
    && !isSceneBasisCurrent(state.openingBasis, deps.openings.accessor);
  if (!wallsStale && !openingsStale) return false;
  const keepNotice = !historyMoved && !levelMoved(state, deps.walls.accessor);
  if (wallsStale) modelFromDrawingSession.refresh(deps.walls, keepNotice);
  if (openingsStale) modelFromDrawingOpeningsSession.refresh(deps.openings, keepNotice);
  return true;
}

/** Συγχωνεύει τα σήματα ενός tick σε ΕΝΑ `syncAssistantToScene`, θυμούμενο αν ανάμεσά τους κινήθηκε το ιστορικό. */
export function createAssistantSceneSync(getDeps: () => AssistantSceneDeps): AssistantSceneSync {
  let historyMoved = false;
  const coalescer = createMicrotaskCoalescer(() => {
    const moved = historyMoved;
    historyMoved = false;
    syncAssistantToScene(getDeps(), moved);
  });
  return {
    sceneChanged: () => coalescer.schedule(),
    historyMoved: () => {
      historyMoved = true;
      coalescer.schedule();
    },
  };
}
