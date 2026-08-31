'use client';

/**
 * 🔴 ADR-767 Δ1 / ADR-753 §28 — **Η ΑΡΝΗΣΗ ΓΡΑΦΗΣ ΣΕ ΔΕΜΕΝΟ ΚΕΛΙ**, εκφρασμένη στο μόνο σημείο
 * που τις πιάνει όλες.
 *
 * ## Γιατί `beforeinput`, και γιατί **native** ακροατής
 *
 * Ένα `contenteditable` δεν έχει `readOnly`. Το ισοδύναμό του είναι το `beforeinput`, που
 * προηγείται **κάθε** μεταβολής περιεχομένου — πληκτρολόγηση, επικόλληση, αποκοπή, drag-drop,
 * IME, undo του browser — οπότε ένα `preventDefault` εκεί τις κλείνει **όλες** με έναν κανόνα.
 * Η επιλογή και η αντιγραφή δεν περνούν από αυτό, άρα μένουν ελεύθερες: ακριβώς η
 * προδιαγραφή «*βλέπω και αντιγράφω, δεν πληκτρολογώ*».
 *
 * ⚠️ **ΠΟΤΕ μέσω του `onBeforeInput` του React — ΜΕΤΡΗΜΕΝΟ ΟΤΙ ΔΕΝ ΔΟΥΛΕΥΕΙ.**
 * Το `onBeforeInput` του React **δεν** είναι ο native ακροατής: είναι ιστορικό synthetic
 * συμβάν, χτισμένο πάνω σε `textInput`/composition polyfill, και ένα πραγματικό
 * `dispatchEvent(new Event('beforeinput', { cancelable: true }))` **δεν το πυροδοτεί** —
 * μετρημένο με άγκυρα (`Ε4`), αφού είχε ήδη γραφτεί ως δουλεύον. Το σύμπτωμα θα ήταν
 * **δεμένο κελί που δέχεται πληκτρολόγηση**, δηλαδή ακριβώς η βλάβη που ο ADR-767 Δ1 υπάρχει
 * για να αποκλείσει — και θα φαινόταν μόνο σε πίνακα με δεσμό.
 *
 * ## 🔴 ADR-833 Φ5Β — ο ΙΔΙΟΣ ακροατής φυλάει και τη **ράγα μήκους**
 * Το `contenteditable` δεν έχει `maxLength`· το ισοδύναμό του είναι **αυτό ακριβώς** το
 * `beforeinput`. Δύο λόγοι άρνησης, **ένας** ακροατής: δεύτερος θα ήταν δεύτερη ευκαιρία να
 * ξεχαστεί μια διαδρομή εισαγωγής. Δες τον σχολιασμό μέσα στη συνάρτηση για το γιατί εδώ η
 * σωστή απάντηση είναι **πρόληψη** και όχι μήνυμα.
 *
 * ⚠️ Ο ακροατής δηλώνεται πλέον **πάντα**, όχι μόνο σε δεμένο κελί: η ράγα ισχύει και στα
 * ελεύθερα κελιά — εκεί ισχύει κυρίως.
 *
 * ## ⚠️ Ο φρουρός παραμένει **διπλός** (N.7.2 #4)
 * Εδώ ζει η **παρουσίαση**· ο πραγματικός φύλακας ζει στο `buildTableCellEditCommand` και
 * πιάνει κάθε άλλο μονοπάτι εγγραφής. Το ένα χωρίς το άλλο είναι ή ευγενική παράκληση ή
 * μυστήριο.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-cell-input-guard
 * @see ui/table-cell-editor/TableCellEditorOverlay.tsx — γιατί όχι `contentEditable={false}`
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md §28
 */

import { useEffect, type RefObject } from 'react';
import { MAX_TABLE_CELL_CHARACTERS } from '../../bim/table/table-ooxml-limits';
import type { TableRichTextField } from '../components/table-text-menu/table-text-toolbar-types';

/**
 * Πόσους χαρακτήρες **προσθέτει** αυτή η μεταβολή. `0` για διαγραφή, μετακίνηση κέρσορα ή
 * αναίρεση — εκείνες δεν μεγαλώνουν τίποτα και δεν επιτρέπεται να φραχθούν ποτέ.
 *
 * ⚠️ Η επικόλληση δεν φέρνει το κείμενο στο `data` αλλά στο `dataTransfer` — και είναι
 * **ακριβώς** η διαδρομή που έχει σημασία εδώ: κανείς δεν πληκτρολογεί 32.767 χαρακτήρες,
 * τους **επικολλά**.
 */
function insertedLength(event: InputEvent): number {
  if (typeof event.data === 'string') return event.data.length;
  const pasted = event.dataTransfer?.getData('text/plain');
  return typeof pasted === 'string' ? pasted.length : 0;
}

/**
 * Θα ξεπερνούσε αυτή η μεταβολή τη ράγα του προτύπου;
 *
 * Το μαρκαρισμένο κείμενο **αφαιρείται**: μια επικόλληση που αντικαθιστά ό,τι υπάρχει δεν
 * μεγαλώνει το κελί, και μια φραγή εκεί θα ήταν άρνηση σε πράξη που χωρά μια χαρά.
 */
function wouldExceedRail(field: TableRichTextField, event: InputEvent): boolean {
  const inserted = insertedLength(event);
  if (inserted === 0) return false;
  const selection = window.getSelection();
  const selected =
    selection !== null && selection.anchorNode !== null && field.contains(selection.anchorNode)
      ? selection.toString().length
      : 0;
  const current = field.textContent?.length ?? 0;
  return current - selected + inserted > MAX_TABLE_CELL_CHARACTERS;
}

/**
 * Απορρίπτει κάθε μεταβολή περιεχομένου όσο το κελί είναι **δεμένο**.
 *
 * Ο ακροατής δηλώνεται και ξαναδηλώνεται με το `readOnly` και μόνο: ένα κελί που ξεκλειδώνει
 * (ADR-767 Δ2) πρέπει να αρχίσει να δέχεται πληκτρολόγηση **στο ίδιο καρέ**, χωρίς να
 * ξαναστηθεί ο επεξεργαστής — αλλιώς ο χρήστης θα έχανε τη θέση του δρομέα του.
 */
export function useTableCellInputGuard(
  fieldRef: RefObject<TableRichTextField | null>,
  readOnly: boolean,
): void {
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const deny = (event: Event): void => {
      // Δεμένο κελί: **τίποτα** δεν γράφεται, ούτε διαγραφή (ADR-767 Δ1).
      if (readOnly) {
        event.preventDefault();
        return;
      }
      // 🔴 ADR-833 Φ5Β — **η ράγα του OOXML, εκεί που η απώλεια γίνεται ΑΔΥΝΑΤΗ αντί για
      // σιωπηλή.** Ο γραφέας (`writeCellInput`) κόβει ούτως ή άλλως στους 32.767 — αλλά η
      // δέσμευση του κελιού **δεν έχει κανάλι αναφοράς**: η επικόλληση περιοχής λέει
      // `clippedTextCells` και η εισαγωγή `.xlsx` λέει `sheetsDropped`, ενώ ο επεξεργαστής
      // κελιού θα έκοβε **χωρίς να το πει κανείς**. Δηλαδή ακριβώς η «σιωπηλή απώλεια» που
      // το §5.6.5 απαγόρευσε, στην πιο πιθανή διαδρομή: επικόλληση παραγράφου σε κελί.
      //
      // 🔑 Η απάντηση δεν είναι δεύτερο μήνυμα, είναι το **σχήμα του Excel**: το πεδίο
      // απλώς **παύει να δέχεται**. Ό,τι δεν μπήκε ποτέ δεν χάθηκε ποτέ — και δεν χρειάζεται
      // εξήγηση. Ζει εδώ γιατί εδώ ζει ήδη η **μία** άρνηση που πιάνει όλες τις διαδρομές
      // (πληκτρολόγηση, επικόλληση, drag-drop, IME, undo του browser).
      if (wouldExceedRail(field, event as InputEvent)) event.preventDefault();
    };
    field.addEventListener('beforeinput', deny);
    return () => field.removeEventListener('beforeinput', deny);
  }, [fieldRef, readOnly]);
}
