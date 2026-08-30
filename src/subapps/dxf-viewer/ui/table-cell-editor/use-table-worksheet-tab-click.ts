'use client';

/**
 * ADR-833 Φάση 3 — **ΤΟ ΠΑΤΗΜΑ ΜΙΑΣ ΚΑΡΤΕΛΑΣ ΦΥΛΛΟΥ**: ο πίνακας δείχνει εκείνο το φύλλο.
 *
 * Τέταρτος καταναλωτής του {@link useTableArmedControlClick}, δίπλα στο `⊕` (§40), στο `⊖`
 * (§42) και στο πινέλο (ADR-768). **Καμία νέα διαδρομή συμβάντος**: ίδιο `mousedown` σε
 * σύλληψη στο δοχείο, ίδια διεκδίκηση του ζευγαρωτού `mouseup`, ίδια κατανάλωση **πριν** από
 * το αποτέλεσμα. Οι τρεις προηγούμενοι πλήρωσαν τα περιστατικά· ο τέταρτος τα κληρονομεί.
 *
 * ## 🔴 ΤΟ «ΟΠΛΙΣΜΕΝΟ» ΕΙΝΑΙ Ο HOVER — και αυτό είναι το σωστό, όχι το βολικό
 * Ο ακροατής **δεν** ξανακάνει hit-test: διαβάζει τι απάντησε η τελευταία κίνηση ποντικιού,
 * δηλαδή **ακριβώς** την καρτέλα που ο χρήστης βλέπει φωτισμένη τη στιγμή που πατά. Μια
 * δεύτερη σάρωση εδώ θα έδινε το ίδιο **σχεδόν πάντα** — και το «σχεδόν» έχει εδώ συγκεκριμένο
 * όνομα: ανάμεσα στην τελευταία κίνηση και το πάτημα μπορεί να έχει αλλάξει το **zoom**
 * (τροχός), και η χωρητικότητα της λωρίδας — άρα και το **παράθυρο υπερχείλισης** — είναι
 * συνάρτηση του zoom. Ο χρήστης θα άλλαζε σε φύλλο που δεν στόχευσε ποτέ.
 *
 * ## Γιατί ΔΕΝ χρειάζεται κλάδος στο `use-table-cell-pointer`
 * Ο pointer της λειτουργίας πίνακα τερματίζει με `if (pointerHit?.where !== 'cell') return;` —
 * **θετική** διατύπωση, γραμμένη στο §40.8 ακριβώς ώστε *«η επόμενη προσθήκη περίπτωσης να
 * είναι αδύνατο να πέσει εδώ κατά λάθος»*. Η καρτέλα είναι εκείνη η επόμενη περίπτωση, και το
 * αρχείο δεν χρειάστηκε **ούτε μία** γραμμή. Ο φύλακας του §29 τη μαθαίνει χωριστά (δες
 * `use-table-canvas-lockdown`), ώστε το `mousedown` να **φτάνει** εδώ.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-worksheet-tab-click
 * @see bim/table/table-worksheet-activate.ts — ΤΙ πρέπει να γίνει (καθαρός σχεδιαστής)
 * @see ui/table-cell-editor/table-scene-patch.ts — ΠΩΣ γράφεται (χωρίς ιστορικό)
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.3
 */

import { type RefObject } from 'react';
import { getTableIndicatorHover } from '../../state/table-indicator-hover-store';
import { planWorksheetActivation } from '../../bim/table/table-worksheet-activate';
import { tableCursorFor } from '../../state/table-cell-cursor-scope';
import { setTableCellCursor } from '../../state/table-cell-cursor-store';
import { applyTableScenePatch } from './table-scene-patch';
import { useTableArmedControlClick } from './use-table-armed-control-click';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { TableWorksheetId } from '../../types/table-worksheet';

/** Η καρτέλα κάτω από το χέρι, στη μορφή που δέχεται ο κοινός ακροατής. */
interface ArmedWorksheetTab {
  readonly entityId: string;
  readonly worksheetId: TableWorksheetId;
}

export interface UseTableWorksheetTabClickParams {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly levelManager: LevelManagerLike;
}

/** Αλλάζει ενεργό φύλλο όταν πατηθεί η καρτέλα του, όσο υπάρχει πίνακας στο προσκήνιο. */
export function useTableWorksheetTabClick(params: UseTableWorksheetTabClickParams): void {
  const { containerRef, levelManager } = params;

  useTableArmedControlClick<ArmedWorksheetTab>({
    containerRef,
    levelManager,
    // Καμία φάση να ελεγχθεί, σε αντίθεση με τα ⊕/⊖: η καρτέλα δεν έχει `nearby` — το
    // ορθογώνιο που φαίνεται **είναι** ο στόχος. Δες το `TablePointerHit`.
    resolveArmed: () => {
      const hover = getTableIndicatorHover();
      if (!hover || hover.target.kind !== 'worksheet-tab') return null;
      return { entityId: hover.entityId, worksheetId: hover.target.worksheetId };
    },
    run: (live, armed) => {
      // 🔴 Ο δρομέας διαβάζεται με τον **ΕΝΑ** φύλακα (`tableCursorFor`: ίδιος πίνακας **και**
      // ίδιο ενεργό φύλλο), τη στιγμή του συμβάντος. `null` σημαίνει «απλή επιλογή» — ο χρήστης
      // δεν είναι μέσα στον πίνακα, άρα δεν υπάρχει δρομέας ούτε να θυμηθούμε ούτε να
      // επαναφέρουμε. Η αλλαγή καρτέλας **δεν** ανοίγει λειτουργία πίνακα.
      const plan = planWorksheetActivation(live, armed.worksheetId, tableCursorFor(live)?.position ?? null);
      // `null` = κλικ στην ήδη ενεργή καρτέλα. Το συμβάν έχει ήδη καταναλωθεί από τον κοινό
      // ακροατή, και **σωστά**: το κουμπί κρατά τη χειρονομία του ακόμα κι όταν η πράξη είναι
      // κενή, αλλιώς το άκαρπο πάτημα θα αποεπέλεγε τον πίνακα (§40.9).
      if (!plan) return;

      applyTableScenePatch(levelManager, live, plan.patch);

      if (plan.restoreCursor) {
        // 🔑 Ο δρομέας δένεται στην **μπαλωμένη** οντότητα, όχι στη `live`: το
        // `setTableCellCursor` διαβάζει το **ενεργό φύλλο** για να γράψει το `worksheetId` του
        // δρομέα (ADR-833 Φ2 — «η μισή ταυτότητα δεν επιτρέπεται να ξεχαστεί»). Με τη `live`, ο
        // δρομέας θα γεννιόταν δεμένος στο φύλλο που μόλις **εγκαταλείφθηκε**.
        //
        // ⚠️ Η σειρά «πρώτα τα δεδομένα, μετά ο δρομέας» **δεν** αφήνει παράθυρο ασυνέπειας, και
        // ο λόγος είναι δομικός: το `setLevelScene` είναι κατάσταση React (ασύγχρονη), το
        // `setTableCellCursor` external store (σύγχρονο). Ένα ενδιάμεσο καρέ θα έβλεπε **παλιά**
        // οντότητα με **νέο** δρομέα — και ο φύλακας της Φάσης 2 τον κρίνει τότε **άκυρο**
        // (`cursor.worksheetId !== activeWorksheet(oldEntity).id`), δηλαδή δεν ζωγραφίζεται
        // τίποτα σε λάθος φύλλο. Το κενό ήταν ήδη κλειστό πριν ανοίξει.
        setTableCellCursor({ ...live, ...plan.patch }, plan.restoreCursor, 'nav');
      }
    },
  });
}
