'use client';

/**
 * 🔴 ADR-828 **Φ4α** — **η React καλωδίωση της πληκτρολογιακής πόρτας** του κουμπιού «Επιλογές
 * Αυτόματης Συμπλήρωσης» (`Alt+↓`).
 *
 * ## Γιατί δικό του αρχείο
 * Το `useTableCellDoubleClickEditor` είναι ο **ένας** τόπος που βλέπει ταυτόχρονα μοντέλο και
 * DOM, άρα ο μόνος που **μπορεί** να δώσει τα τέσσερα κομμάτια που χρειάζεται αυτή η πόρτα.
 * Ήταν όμως ήδη στις **495** γραμμές — η ίδια του η κεφαλίδα καταγράφει ότι το §31.10
 * μετακόμισε ήδη μία φορά για τον ίδιο λόγο (N.7.1, όριο 500).
 *
 * Άρα η επιλογή δεν ήταν «εδώ ή εκεί» αλλά «**εξαγωγή ή κόψιμο τεκμηρίωσης**». Εξαγωγή: εδώ
 * ζει ολόκληρο το *γιατί* (getter αντί στιγμιότυπου, writer χτισμένος τη στιγμή της κλήσης),
 * και εκεί μένει **μία γραμμή** σύνδεσης. Το κριτήριο είναι το ίδιο που έβγαλε ήδη τον
 * `onCornerPress` και τον `useTableNameBoxGoto`.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-fill-badge-key
 * @see ui/table-cell-editor/table-fill-badge-press.ts — η γνώση («ζει το κουμπί; πού;»)
 * @see ui/table-cell-editor/table-cell-key-intent.ts — γιατί ΑΚΡΙΒΩΣ το `Alt+↓`
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §8
 */

import type React from 'react';
import { useEventCallback } from '@/hooks/useEventCallback';
import { tryOpenTableFillBadgeMenuByKey } from './table-fill-badge-press';
import { getTableCellCursor } from '../../state/table-cell-cursor-store';
import type { TableEntity } from '../../types/table-entity';
import type { ViewTransform } from '../../rendering/types/Types';

export interface UseTableFillBadgeKeyParams {
  /** Ο **αναγνώστης** της οντότητας — ποτέ τιμή του render· δες παρακάτω. */
  readonly liveTable: () => TableEntity | null;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly transformRef: React.RefObject<ViewTransform>;
  /** Η **ΜΙΑ** διαδρομή εγγραφής μοντέλου του πίνακα. */
  readonly commit: (entity: TableEntity, model: TableEntity['model']) => void;
}

/**
 * Ο χειριστής του `Alt+↓`: άνοιξε το μενού **πάνω στο κουμπί**, αν το κουμπί ζει.
 *
 * ⚠️ **Τα τέσσερα διαβάζονται τη στιγμή του πλήκτρου, κανένα δεν είναι στιγμιότυπο** (ADR-040
 * κανόνας #2). Ανάμεσα στο τελευταίο render και στο πάτημα χωρά μετακίνηση δρομέα, pan, zoom,
 * ακόμη και `Ctrl+Z` που σβήνει τον πίνακα — και μια κλεισμένη τιμή θα έκρινε το «ζει το
 * κουμπί;» πάνω σε κόσμο που δεν υπάρχει πια.
 *
 * Ο `writer` χτίζεται εδώ, από δύο **σταθερές** αναφορές: είναι ό,τι ακριβώς χρειάζεται η ΜΙΑ
 * εγγραφή (`commitTableFill`) και τίποτε άλλο — καμία ψεύτικη χειρονομία ποντικιού για να
 * μπορέσει το πληκτρολόγιο να γράψει.
 *
 * Σιωπηλό no-op όταν λείπει οτιδήποτε: το πλήκτρο έχει ήδη καταναλωθεί από τον
 * `use-table-cell-session-keys` (με `preventDefault`), και «τίποτα» είναι η σωστή έκβαση —
 * όχι μενού αγκυρωμένο σε συντεταγμένες που δεν λύθηκαν.
 */
export function useTableFillBadgeKey(params: UseTableFillBadgeKeyParams): () => void {
  const { liveTable, containerRef, transformRef, commit } = params;
  return useEventCallback((): void => {
    const entity = liveTable();
    const container = containerRef.current;
    const transform = transformRef.current;
    if (!entity || !container || !transform) return;
    tryOpenTableFillBadgeMenuByKey({
      entity,
      cursor: getTableCellCursor(),
      container,
      transform,
      writer: { liveTable, commit },
    });
  });
}
