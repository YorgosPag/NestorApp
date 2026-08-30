'use client';

/**
 * 🔴 ADR-833 Φάση 4 — **ΠΟΙΑ ΚΑΡΤΕΛΑ ΜΕΤΟΝΟΜΑΖΕΤΑΙ ΑΥΤΗ ΤΗ ΣΤΙΓΜΗ.**
 *
 * Ο δίδυμος του `opening-info-tag-editor-store` (ADR-612): κατάσταση ανοίγματος ενός
 * **in-place** επεξεργαστή πάνω από τον καμβά, με το ορθογώνιό του σε **client px** — δηλαδή
 * ακριβώς το ίδιο συμβόλαιο, για το ίδιο είδος επιφάνειας.
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ Ο ΕΠΕΞΕΡΓΑΣΤΗΣ ΚΕΛΙΟΥ — μετρημένο, όχι ένστικτο
 * Το ερώτημα είναι γνήσιο (η καρτέλα είναι «κείμενο μέσα σε ορθογώνιο», όπως το κελί) και η
 * απάντηση προκύπτει από **μέτρηση** του `TableCellEditorOverlay`: **474 γραμμές**, και ο
 * τύπος που δέχεται (`TableCellEditTarget`) κουβαλά **έντεκα** πεδία που ένα φύλλο δεν έχει
 * — μοντέλο, δρομέα, τύπους, τμήματα πλούσιου κειμένου, διαδρομή εγγραφής (`bound`/`owner`),
 * στοίχιση, εσοχή, γραμμή βάσης, ζώνη εκτύπωσης, `caretRevision`, `runs`. Το να περάσει από
 * εκεί μια καρτέλα θα σήμαινε **ψεύτικες τιμές σε έντεκα πεδία**, και ο πρώτος που θα τις
 * διάβαζε αφελώς θα έγραφε σε κελί που δεν υπάρχει.
 *
 * 🔑 Ό,τι **είναι** κοινό, επαναχρησιμοποιείται ολόκληρο και χωρίς αντίγραφο:
 * ο κύκλος `Enter`/`Esc`/blur ({@link useInlineEditorKeys}, ο ίδιος που τρέχει και στον
 * επεξεργαστή κελιού και στο info-tag), η **μία** διαδρομή εντολής
 * (`use-table-worksheet-apply`), και ο **ένας** επιλυτής ονόματος (`worksheetDisplayName`).
 *
 * ## ⚠️ ΤΟ ΟΡΘΟΓΩΝΙΟ ΕΙΝΑΙ ΣΤΑΤΙΚΟ — και γι' αυτό η συνεδρία **κλείνει** σε pan/zoom
 * Το `anchorRect` υπολογίζεται **μία φορά**, τη στιγμή του ανοίγματος (ίδια σύμβαση με το
 * ADR-612). Ένα κουτί που μένει καρφωμένο ενώ ο καμβάς κινείται θα ξεκολλούσε από την καρτέλα
 * του — το ελάττωμα που ο `TextEditorAnchorLayer` υπάρχει για να λύσει, με τίμημα ολόκληρο
 * κέλυφος αγκύρωσης και `containerRef` μέσα από τον orchestrator (ADR-040).
 *
 * Η φθηνότερη **σωστή** απάντηση δεν είναι καμία από τις δύο: η μετονομασία **δεσμεύεται**
 * μόλις αλλάξει ο μετασχηματισμός. Έτσι η στατική θέση δεν μπορεί να παλιώσει — **δομικά**,
 * όχι κατά σύμβαση — και ο χρήστης δεν χάνει ό,τι πληκτρολόγησε. Δες τον overlay.
 *
 * @module subapps/dxf-viewer/state/table-worksheet-rename-store
 * @see ui/table-cell-editor/TableWorksheetRenameOverlay.tsx — η επιφάνεια (micro-leaf, ADR-040)
 * @see state/opening-info-tag-editor-store.ts — ο αδελφός που δίνει το συμβόλαιο
 */

import { createExternalStore } from '../stores/createExternalStore';
import type { TableWorksheetId } from '../types/table-worksheet';

/** Το ορθογώνιο του επεξεργαστή σε **client px** — ό,τι δέχεται ένα `position: fixed`. */
export interface TableWorksheetRenameRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TableWorksheetRenameState {
  readonly entityId: string;
  readonly worksheetId: TableWorksheetId;
  /**
   * 🔴 Το **ρητό** όνομα του φύλλου, ή κενό — **ποτέ** το προεπιλεγμένο της θέσης.
   *
   * Το Excel προ-συμπληρώνει το ορατό όνομα, γιατί εκεί κάθε φύλλο **έχει** αποθηκευμένο
   * όνομα. Εμείς έχουμε την κατάσταση «ανώνυμο» (§3 του `types/table-worksheet.ts`), και μια
   * προ-συμπλήρωση με το «Φύλλο2» θα σήμαινε ότι ένα `Enter` **χωρίς πληκτρολόγηση**
   * υλοποιεί το προεπιλεγμένο όνομα μέσα στα δεδομένα — δηλαδή παγώνει τη γλώσσα του
   * δημιουργού, ακριβώς ο παραβάτης που το §5.2 απέρριψε.
   *
   * Το προεπιλεγμένο όνομα φαίνεται ως **placeholder**: ο χρήστης βλέπει τι αντικαθιστά,
   * χωρίς να το γράφει κανείς για λογαριασμό του.
   */
  readonly initialName: string;
  /** Το προεπιλεγμένο όνομα της θέσης — **μόνο** ως placeholder. */
  readonly placeholder: string;
  readonly anchorRect: TableWorksheetRenameRect;
}

const store = createExternalStore<TableWorksheetRenameState | null>(null);

/** Ανοίγει τη μετονομασία. Δεύτερη κλήση αντικαθιστά — υπάρχει **μία** συνεδρία τη φορά. */
export function openTableWorksheetRename(state: TableWorksheetRenameState): void {
  store.set(state);
}

/** Κλείνει τη συνεδρία — από **κάθε** έξοδό της (Enter, Esc, blur, αλλαγή προβολής). */
export function closeTableWorksheetRename(): void {
  if (store.get() !== null) store.set(null);
}

/** useSyncExternalStore-compatible subscribe. */
export const subscribeTableWorksheetRename = (cb: () => void): (() => void) => store.subscribe(cb);

/** useSyncExternalStore-compatible snapshot. Ίδια αναφορά μεταξύ αλλαγών. */
export const getTableWorksheetRename = (): TableWorksheetRenameState | null => store.get();

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα αδελφά stores. */
export function __resetTableWorksheetRenameForTests(): void {
  store.reset(null);
}
