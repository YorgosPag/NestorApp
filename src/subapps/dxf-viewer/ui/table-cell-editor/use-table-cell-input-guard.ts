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
import type { TableRichTextField } from '../components/table-text-menu/table-text-toolbar-types';

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
    if (!field || !readOnly) return;
    const deny = (event: Event): void => event.preventDefault();
    field.addEventListener('beforeinput', deny);
    return () => field.removeEventListener('beforeinput', deny);
  }, [fieldRef, readOnly]);
}
