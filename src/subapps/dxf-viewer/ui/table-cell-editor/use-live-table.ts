'use client';

/**
 * **Ο πίνακας του δρομέα, τη στιγμή της κλήσης** — μία φορά, για κάθε χειριστή που τον ζητά.
 *
 * ## Γιατί getter και όχι τιμή
 * ADR-040 κανόνας #2: οι χειριστές συμβάντων διαβάζουν με **getter**, ποτέ από στιγμιότυπο
 * απόδοσης. Ένα `useTableCellCursor()` εδώ θα έκανε συνδρομή τον orchestrator που φιλοξενεί τα
 * hooks (`CanvasSection`) — και, χειρότερα, ένα δεξί κλικ θα απαντούσε με την κατάσταση του
 * **τελευταίου render**, δηλαδή με πίνακα που μπορεί να έχει ήδη σβηστεί από undo.
 *
 * ## Γιατί χωριστό αρχείο
 * Το ζητούν ήδη **δύο** χειριστές — το μενού των ζωνών δείκτη (ADR-739 Φ.Δ) και το μενού
 * περιγραμμάτων της επιλογής (ADR-750 Φ4) — και θα το ζητήσει και η μη-modal ζωγραφική ακμών
 * (Φ7). Τρεις γραμμές αντιγραμμένες τρεις φορές δεν φτάνουν το κατώφλι του jscpd (N.18), άρα
 * είναι ακριβώς το είδος διπλότυπου που **καμία πύλη δεν βλέπει** και που αποκλίνει σιωπηλά
 * την ημέρα που θα αλλάξει η πηγή του δρομέα.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-live-table
 */

import { useCallback } from 'react';
import { getTableCellCursor } from '../../state/table-cell-cursor-store';
import { tableForCursor } from '../../state/table-cell-cursor-scope';
import { resolveTableById } from './table-entity-lookup';
import type { TableEntity } from '../../types/table-entity';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

/**
 * `null` χωρίς ενεργό δρομέα, όταν η οντότητα δεν υπάρχει πια στη σκηνή — **ή όταν ο δρομέας
 * ανήκει σε φύλλο εργασίας που δεν είναι πια το ενεργό** (ADR-833 Φάση 2).
 *
 * 🔴 Ο τρίτος λόγος δεν είναι επιπλέον έλεγχος, είναι **ο ορισμός**: «ο πίνακας του δρομέα»
 * παύει να υπάρχει τη στιγμή που ο δρομέας δείχνει αλλού. Κάθε καταναλωτής χειρίζεται ήδη το
 * `null` (`if (!live) return`), οπότε η ασφάλεια έρχεται **χωρίς καμία γραμμή** στα ~15 σημεία
 * που ζητούν τον ζωντανό πίνακα — και χωρίς κανένα από αυτά να μπορεί να την ξεχάσει.
 */
export function useLiveTable(levelManager: LevelManagerLike): () => TableEntity | null {
  return useCallback((): TableEntity | null => {
    const cursor = getTableCellCursor();
    if (!cursor) return null;
    return tableForCursor(resolveTableById(levelManager, cursor.entityId), cursor);
  }, [levelManager]);
}
