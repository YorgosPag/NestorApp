'use client';

/**
 * 🔴 ADR-739 §52 — **ΥΠΑΡΧΕΙ ΔΡΟΜΕΑΣ ΚΕΛΙΟΥ;** — ένα `boolean`, και τίποτα άλλο.
 *
 * ## Γιατί χωριστό hook αντί για `useTableCellCursor()`
 * Ο καταναλωτής είναι ο resolver του contextual trigger (`useActiveContextualTrigger`), που
 * ζει στον `DxfViewerContent`. Μια συνδρομή στο **ολόκληρο** store εκεί θα σήμαινε:
 *
 * ```
 *   κάθε πλήκτρο → νέο `draft` → νέο state → re-render του orchestrator → επανυπολογισμός
 *   trigger → re-render της κορδέλας … ανά ΧΑΡΑΚΤΗΡΑ
 * ```
 *
 * δηλαδή **ορατό lag πληκτρολόγησης** — ακριβώς η παλινδρόμηση που έκλεισαν τα ADR-040 / 532 /
 * 547. Ο δρομέας γράφεται σε κάθε πάτημα (`setTableCellCursorDraft`), και το `equals` του
 * store **δεν** σώζει: το `draft` όντως άλλαξε.
 *
 * Με `boolean` στιγμιότυπο, το `useSyncExternalStore` κάνει `Object.is` και **σταματά εκεί**:
 * κάθε πλήκτρο κοστίζει μία σύγκριση δύο boolean, μηδέν re-render. Ο δείκτης αλλάζει ακριβώς
 * **δύο** φορές σε ολόκληρη μια συνεδρία γραφής — στην είσοδο και στην έξοδο.
 *
 * ## Γιατί «υπάρχει δρομέας» και όχι «είναι σε κατάσταση `edit`»
 * Η μορφοποίηση έχει καλά ορισμένο στόχο σε **κάθε** κατάσταση του δρομέα: σε `nav` ο στόχος
 * είναι το ενεργό κελί ή η μαρκαρισμένη περιοχή, ακριβώς όπως στο Excel — όπου η κορδέλα
 * μορφοποιεί μαρκαρισμένα κελιά χωρίς να γράφεις μέσα τους. Ένα φράγμα στο `edit` θα έκρυβε
 * την καρτέλα ακριβώς στην πιο συνηθισμένη χρήση («μαρκάρω B2:B9, πατάω Β»).
 *
 * @module subapps/dxf-viewer/state/use-table-cell-cursor-active
 * @see state/table-cell-cursor-store.ts — το store και οι τρεις καταστάσεις του
 * @see app/ribbon-contextual-config.ts — ο μοναδικός καταναλωτής (σύνθετο trigger)
 */

import { useSyncExternalStore } from 'react';
import { getTableCellCursor, subscribeTableCellCursor } from './table-cell-cursor-store';

function snapshot(): boolean {
  return getTableCellCursor() !== null;
}

/** `true` όσο υπάρχει ενεργό κελί σε πίνακα — ανεξάρτητα από το τι πληκτρολογείται μέσα του. */
export function useTableCellCursorActive(): boolean {
  return useSyncExternalStore(subscribeTableCellCursor, snapshot, () => false);
}
