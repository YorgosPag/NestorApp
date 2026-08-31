'use client';

/**
 * ADR-833 Φάσεις 3+4 — **ΤΟ ΠΑΤΗΜΑ ΜΕΣΑ ΣΤΗ ΛΩΡΙΔΑ ΦΥΛΛΩΝ**: καρτέλα ⇒ ο πίνακας δείχνει
 * εκείνο το φύλλο· ⊕ ⇒ γεννιέται νέο φύλλο στο τέλος.
 *
 * ## 🔴 ΔΥΟ ΠΡΑΞΕΙΣ, ΔΥΟ ΔΙΑΔΡΟΜΕΣ ΕΓΓΡΑΦΗΣ — και η διάκριση είναι το νόημα της Φάσης 4
 * ```
 *   καρτέλα → ΑΛΛΑΖΕΙ ΤΟ ΠΟΙΟ ΒΛΕΠΕΙΣ → applyTableScenePatch → ΚΑΝΕΝΑ βήμα undo (Excel parity)
 *   ⊕       → ΑΛΛΑΖΕΙ ΤΟ ΤΙ ΥΠΑΡΧΕΙ   → UpdateEntityCommand  → ΕΝΑ βήμα undo
 * ```
 * Ζουν στον **ίδιο** ακροατή επειδή μοιράζονται τη χειρονομία (ίδια λωρίδα, ίδιο `mousedown` σε
 * σύλληψη, ίδια διεκδίκηση του ζευγαρωτού `mouseup`), **όχι** επειδή μοιράζονται σημασιολογία.
 * Ένας γραφέας για τα δύο θα σήμαινε είτε στοίβα αναίρεσης γεμάτη «άλλαξα καρτέλα», είτε νέο
 * φύλλο που το `Ctrl+Z` δεν παίρνει πίσω.
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
import { useCommandHistory } from '../../core/commands';
import { getTableIndicatorHover } from '../../state/table-indicator-hover-store';
import { planWorksheetActivation } from '../../bim/table/table-worksheet-activate';
import { tableCursorFor } from '../../state/table-cell-cursor-scope';
import { setTableCellCursor } from '../../state/table-cell-cursor-store';
import { applyTableScenePatch } from './table-scene-patch';
import { useTableArmedControlClick } from './use-table-armed-control-click';
import { useTableWorksheetAdd, useTableWorksheetApply } from './use-table-worksheet-apply';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { TableWorksheetId } from '../../types/table-worksheet';

/**
 * Τι της λωρίδας είναι οπλισμένο, στη μορφή που δέχεται ο κοινός ακροατής.
 *
 * Διακριτή ένωση και όχι «ταυτότητα ή `null`»: το ⊕ **δεν είναι φύλλο**. Δες τη δήλωση του
 * `'worksheet-add'` στο `table-pointer-hit-kinds.ts` για το τι κοστίζει ένα προσποιητό φύλλο.
 */
type ArmedWorksheetStrip =
  | { readonly entityId: string; readonly kind: 'tab'; readonly worksheetId: TableWorksheetId }
  | { readonly entityId: string; readonly kind: 'add' };

export interface UseTableWorksheetTabClickParams {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly levelManager: LevelManagerLike;
}

/** Εκτελεί ό,τι υπόσχεται η λωρίδα φύλλων, όσο υπάρχει πίνακας στο προσκήνιο. */
export function useTableWorksheetTabClick(params: UseTableWorksheetTabClickParams): void {
  const { containerRef, levelManager } = params;
  const { execute } = useCommandHistory();
  const applyWorksheet = useTableWorksheetApply({ levelManager, execute });
  const addWorksheet = useTableWorksheetAdd({ levelManager, execute });

  useTableArmedControlClick<ArmedWorksheetStrip>({
    containerRef,
    levelManager,
    // Καμία φάση να ελεγχθεί, σε αντίθεση με τα ⊕/⊖ των ζωνών: ούτε η καρτέλα ούτε το ⊕ της
    // λωρίδας έχουν `nearby` — το ορθογώνιο που φαίνεται **είναι** ο στόχος. Δες το
    // `TablePointerHit`.
    resolveArmed: () => {
      const hover = getTableIndicatorHover();
      if (hover?.target.kind === 'worksheet-add') return { entityId: hover.entityId, kind: 'add' };
      if (hover?.target.kind !== 'worksheet-tab') return null;
      return { entityId: hover.entityId, kind: 'tab', worksheetId: hover.target.worksheetId };
    },
    run: (live, armed) => {
      if (armed.kind === 'add') {
        // 🔴 **Εντολή, όχι μπάλωμα σκηνής.** Το νέο φύλλο είναι **δεδομένα**: ένα `Ctrl+Z`
        // οφείλει να το πάρει πίσω. Δες την κεφαλίδα για τη γραμμή που χωρίζει τις δύο πράξεις.
        //
        // ⚠️ Ο δρομέας **δεν** ακολουθεί: το σχέδιο δηλώνει ρητά `restoreCursor: null`, γιατί
        // η προσθήκη φύλλου δεν είναι είσοδος σε λειτουργία πίνακα.
        //
        // 🔴 ADR-833 Φ5Β — **ο ΕΝΑΣ δρόμος**, ο ίδιος με το «Νέο φύλλο» του μενού: όταν ο
        // πίνακας έχει φτάσει το μερίδιό του, η πράξη αρνείται και το **λέει με αριθμό**
        // αντί να μείνει σιωπηλά αδρανής.
        addWorksheet(live);
        return;
      }
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
