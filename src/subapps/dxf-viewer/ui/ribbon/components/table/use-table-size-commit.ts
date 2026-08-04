'use client';

/**
 * ADR-739 §39 — **ο μοναδικός δρόμος «μέγεθος → πίνακας»**.
 *
 * Τον καλούν **και** το πλέγμα **και** ο διάλογος «Εισαγωγή πίνακα…». Δύο αντίγραφα αυτής
 * της ακολουθίας θα ήταν δύο ευκαιρίες να ξεχαστεί το `onToolChange` ή να αντιστραφεί η
 * σειρά (N.18).
 *
 * ## Η σειρά ΔΕΝ είναι αδιάφορη: πρώτα ο store, μετά το εργαλείο
 * Το φάντασμα WYSIWYG (`drawing-preview-generator.ts`) διαβάζει το **ζωντανό** στιγμιότυπο
 * του store μέσω `buildTableEntityFromLiveOptions`. Αν οπλίζαμε πρώτα το εργαλείο, το πρώτο
 * καρέ του φαντάσματος θα ζωγράφιζε το **προηγούμενο** μέγεθος — ο χρήστης θα διάλεγε 5×2 και
 * θα έβλεπε 3×5 να τον ακολουθεί μέχρι την επόμενη κίνηση ποντικιού.
 *
 * ## Γιατί εδώ σταματά η ευθύνη μας
 * Το εργαλείο `table` τοποθετεί με **ένα κλικ** (πάνω-αριστερή γωνία, σύμβαση ACAD_TABLE): το
 * μενού δηλώνει **τι**, ο καμβάς **πού**. Δεν δημιουργούμε οντότητα εδώ.
 *
 * @module subapps/dxf-viewer/ui/ribbon/components/table/use-table-size-commit
 */

import { useCallback } from 'react';
import { useTableOptionsStore } from '../../../../state/table-options-store';
import { useRibbonDispatch } from '../../context/RibbonCommandContext';
import type { ToolType } from '../../../toolbar/types';
import { type TableMenuSize, totalRowsToDataRowCount } from './table-size-menu-model';

const TABLE_TOOL: ToolType = 'table';

/**
 * Γράφει το μέγεθος στον store και οπλίζει το εργαλείο πίνακα.
 *
 * @param columnWidthMm προαιρετικό — το πλέγμα δεν αγγίζει το πλάτος (κρατά ό,τι ισχύει),
 *   ο διάλογος το ορίζει ρητά.
 */
export function useTableSizeCommit(): (size: TableMenuSize, columnWidthMm?: number) => void {
  const { onToolChange } = useRibbonDispatch();

  return useCallback(
    (size: TableMenuSize, columnWidthMm?: number) => {
      // Οι setters του store καθαρίζουν μόνοι τους (`sanitizeTable*`) — μηδέν φράγμα εδώ.
      const store = useTableOptionsStore.getState();
      store.setColumnCount(size.columnCount);
      store.setDataRowCount(totalRowsToDataRowCount(size.totalRowCount));
      if (columnWidthMm !== undefined) store.setColumnWidthMm(columnWidthMm);

      onToolChange(TABLE_TOOL);
    },
    [onToolChange],
  );
}
