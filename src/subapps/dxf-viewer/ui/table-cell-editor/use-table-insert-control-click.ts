'use client';

/**
 * 🔴 ADR-739 §40 — **ΤΟ ΠΑΤΗΜΑ ΤΟΥ ⊕**: μία εισαγωγή γραμμής/στήλης, μία εντολή, ένα `Ctrl+Z`.
 *
 * ## 🔴 ΔΕΝ ΞΑΝΑΚΑΝΕΙ HIT-TEST — και αυτό είναι ολόκληρη η σχεδίαση
 * Ο ακροατής **δεν** ρωτά τη γεωμετρία «πού έπεσε αυτό το κλικ;». Διαβάζει τι απάντησε ήδη η
 * τελευταία κίνηση ποντικιού (`table-insert-control-store`) — δηλαδή **ακριβώς** το χειριστήριο
 * που ο χρήστης βλέπει ζωγραφισμένο τη στιγμή που πατά.
 *
 * Μια δεύτερη σάρωση εδώ θα ήταν ταυτόσημη αριθμητική με το `mousemove`, οπότε «θα έδινε το
 * ίδιο». Θα το έδινε **σχεδόν πάντα** — και το «σχεδόν» είναι το πρόβλημα: ανάμεσα στην
 * τελευταία κίνηση και το πάτημα μπορεί να έχει αλλάξει το zoom (τροχός), το επίπεδο, ή το ίδιο
 * το μοντέλο (undo από συντόμευση). Τότε η γεωμετρία θα απαντούσε για **άλλο** σύνορο από
 * εκείνο που είναι βαμμένο στην οθόνη, και ο χρήστης θα έπαιρνε στήλη σε θέση που δεν
 * στόχευσε — ένα σφάλμα που δεν αφήνει ίχνος, γιατί το αποτέλεσμα είναι απολύτως έγκυρο.
 *
 * Ο κανόνας: *ό,τι πατιέται είναι ό,τι φαίνεται*. Μία απάντηση, ένας γραφέας, ένας αναγνώστης.
 *
 * ## Γιατί `mousedown` σε φάση σύλληψης, και γιατί καταναλώνει το συμβάν
 * Ο πίνακας είναι **επιλεγμένη οντότητα** τη στιγμή που φαίνεται το ⊕. Ένα `mousedown` που
 * φτάνει στον καμβά ξεκινά είτε σύρση οντότητας είτε πλαίσιο επιλογής — δηλαδή το πάτημα του
 * κουμπιού θα μετακινούσε τον πίνακα. Γι' αυτό, **και μόνο όταν το χειριστήριο είναι
 * οπλισμένο**, το συμβάν σταματά εδώ.
 *
 * ⚠️ Στη φάση `nearby` το συμβάν **περνά ανέγγιχτο**. Εκεί το ⊕ φαίνεται αλλά δεν πατιέται
 * (§40), και μια σιωπηλή κατανάλωση θα σήμαινε ότι ο χρήστης χάνει κλικ σε ολόκληρη τη λωρίδα
 * γύρω από τον πίνακα χωρίς να συμβαίνει τίποτα — η χειρότερη εκδοχή του «δεν δουλεύει».
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-insert-control-click
 * @see bim/table/table-insert-control.ts — ΠΟΙΟ ⊕ και σε ποια φάση (η μία σάρωση)
 * @see state/table-insert-control-store.ts — η απάντηση της τελευταίας κίνησης
 * @see bim/table/table-row-column-ops.ts — ΤΙ κάνει η εισαγωγή (καθαρό, ήδη υπάρχον)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §40
 */

import { type RefObject } from 'react';
import { useEventCallback } from '@/hooks/useEventCallback';
import { useCommandHistory } from '../../core/commands';
import {
  canInsertTableColumn,
  canInsertTableRow,
  insertTableColumn,
  insertTableRow,
} from '../../bim/table/table-row-column-ops';
import { getTableInsertControl } from '../../state/table-insert-control-store';
// 🔴 §40.8 — ο ΕΝΑΣ ορισμός του «το πάτημα έπεσε μέσα στη συνεδρία» (§26.15), κοινός με τον pointer.
import { claimTableCellSessionPointerDown } from './table-cell-session-focus';
// 🔴 §40.8 — ο ΕΝΑΣ τρόπος προσάρτησης ακροατή σύλληψης στο δοχείο (κοινός με τον pointer, N.18).
import { useTableContainerMouseDown } from './use-table-container-mousedown';
import { useTableModelCommit } from './use-table-model-commit';
import { resolveTableById } from './table-entity-lookup';
import type { TableInsertControlTarget } from '../../bim/table/table-insert-control';
import type { PersistedTableModel } from '../../types/table';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTableInsertControlClickParams {
  /** Το **ίδιο** `active` με τον hover: χωρίς πίνακα δεν υπάρχει τίποτα να πατηθεί. */
  readonly active: boolean;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly levelManager: LevelManagerLike;
}

/** Εκτελεί την εισαγωγή που υπόσχεται το οπλισμένο ⊕, όσο υπάρχει πίνακας στο προσκήνιο. */
export function useTableInsertControlClick(params: UseTableInsertControlClickParams): void {
  const { active, containerRef, levelManager } = params;
  const { execute } = useCommandHistory();
  // Η ΙΔΙΑ διαδρομή commit με το μενού ζωνών και την επεξεργασία κελιού: ένα
  // `UpdateEntityCommand`, ένα `Ctrl+Z`, καμία δεύτερη διαδρομή εγγραφής (§6.6).
  const commitModel = useTableModelCommit({ levelManager, execute });

  const handleMouseDown = useEventCallback((event: MouseEvent): void => {
    // Μόνο το κύριο κουμπί: το δεξί κλικ ανήκει στον δρομολογητή μενού, το μεσαίο στο pan.
    if (event.button !== 0) return;
    const state = getTableInsertControl();
    if (!state || state.control.phase !== 'armed') return;

    // Η οντότητα διαβάζεται **τη στιγμή του συμβάντος** από τη σκηνή, ποτέ από στιγμιότυπο: η
    // σκηνή ανανεώνεται ασύγχρονα (autosave) και μια κρατημένη αναφορά γίνεται μπαγιάτικη χωρίς
    // ορατό σημάδι — δες την κεφαλίδα του `table-entity-lookup`.
    const live = resolveTableById(levelManager, state.entityId);
    if (!live) return;

    // 🔴 §40.8 — **Η ΚΑΤΑΝΑΛΩΣΗ ΠΡΟΗΓΕΙΤΑΙ ΤΟΥ ΑΠΟΤΕΛΕΣΜΑΤΟΣ** (2026-08-04, ήταν από κάτω).
    //
    // Το κλικ ανήκει στο ⊕ επειδή το ⊕ είναι **οπλισμένο**, όχι επειδή η εισαγωγή πέτυχε. Ένα
    // απενεργοποιημένο κουμπί εξακολουθεί να καταπίνει το πάτημά του — δεν το παραδίδει σε ό,τι
    // βρίσκεται από πίσω. Με την παλιά σειρά, στο **όριο πλήθους** (`canInsert*` → «όχι») το
    // `mousedown` συνέχιζε τη διαδρομή του και ο καμβάς έπαιρνε τη μεταφορά εστίασης: δηλαδή
    // `blur` στο `<textarea>` της συνεδρίας ⇒ **η λειτουργία πίνακα έκλεινε** επειδή ο χρήστης
    // πάτησε ένα κουμπί που δεν είχε τίποτα να κάνει. Δες την κεφαλίδα για το γιατί η φάση
    // `nearby` εξακολουθεί να μη διεκδικεί απολύτως τίποτα.
    event.preventDefault();
    event.stopPropagation();
    // 🔴 §40.8 — **δίχτυ, όχι πρωτεύων δρόμος** (N.7.2 #4). Ο πρωτεύων είναι το `preventDefault`
    // από πάνω: χωρίς μεταφορά εστίασης δεν γεννιέται `blur`, άρα δεν υπάρχει τίποτα να
    // σκοτώσει τη συνεδρία. Η δήλωση καλύπτει τον **δεύτερο** δρόμο προς το ίδιο `focusout` —
    // το ξαναστήσιμο του πεδίου όταν η εισαγωγή αλλάξει τη διάταξη κάτω από τον δρομέα
    // (`focusout` (Α) του §26.15, που δεν είναι προεπιλεγμένη ενέργεια και δεν αναιρείται).
    // Ο ΙΔΙΟΣ ένας ορισμός του «δεν έφυγα» με τον pointer, καμία δεύτερη έννοια.
    claimTableCellSessionPointerDown();

    const nextModel = applyInsert(live.model, state.control.target);
    // Το φράγμα πλήθους (`canInsert*`) απάντησε «όχι» ⇒ καμία εντολή, κανένα ιστορικό. Η
    // ταυτότητα κατά αναφορά είναι η ΙΔΙΑ σύμβαση no-op που χρησιμοποιεί ήδη το μενού ζωνών.
    if (nextModel === live.model) return;

    commitModel(live, nextModel);
  });

  // Σύλληψη: πρέπει να προλάβει τον χειριστή επιλογής/σύρσης του καμβά, που ζει στο ίδιο
  // container. Ίδια επιλογή φάσης με το `use-table-cell-pointer` — και πλέον ο **ίδιος** ένας
  // τρόπος προσάρτησης (§40.8, N.18): η σειρά εγγραφής ακροατών δεν είναι συμβόλαιο, η φάση
  // είναι, και δύο αντίγραφα της φάσης είναι δύο ευκαιρίες να αποκλίνει.
  useTableContainerMouseDown({ active, containerRef, onMouseDown: handleMouseDown });
}

/**
 * Η **μία** μετάφραση «σύνορο ⇒ πράξη».
 *
 * Το `line` του χειριστηρίου είναι ήδη δείκτης συνόρου — ακριβώς το όρισμα που περιμένουν οι
 * δύο συναρτήσεις. Καμία αριθμητική εδώ: μια μετατόπιση κατά ένα θα εισήγαγε σταθερά στη λάθος
 * μεριά, και θα ήταν αόρατη σε κάθε test που δεν μετρά **ποια** στήλη μεγάλωσε.
 */
function applyInsert(
  model: PersistedTableModel,
  target: TableInsertControlTarget,
): PersistedTableModel {
  if (target.axis === 'column') {
    return canInsertTableColumn(model) ? insertTableColumn(model, target.line) : model;
  }
  return canInsertTableRow(model) ? insertTableRow(model, target.line) : model;
}
