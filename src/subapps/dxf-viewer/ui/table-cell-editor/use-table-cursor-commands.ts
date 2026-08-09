'use client';

/**
 * ADR-739 §66 — οι εντολές πλήκτρων που χρειάζονται **μόνο** τον δρομέα και την οντότητα.
 *
 * Ζουν εδώ επειδή το `useTableCellDoubleClickEditor` δηλώνει στην κεφαλίδα του ένα ρητό
 * κριτήριο: είναι ο τόπος που βλέπει **ταυτόχρονα** το μοντέλο και το DOM, και *«ό,τι δεν
 * χρειάζεται και τα δύο, ζει αλλού»*. Αυτές οι δύο δεν αγγίζουν DOM — δεν ρωτούν container,
 * δεν ξέρουν από αγκύρωση, δεν διαβάζουν προβολή. Το ότι κάθονταν εκεί ήταν συνέπεια του ότι
 * ο δρομέας τυχαίνει να διαβάζεται εκεί, όχι απόφαση.
 *
 * Η μετακόμιση έγινε με αφορμή το όριο των 500 γραμμών (N.7.1), αλλά το **κριτήριο** ήταν
 * γραμμένο πριν από αυτήν: εξαγωγή σε υπεύθυνο module, ποτέ ψαλίδισμα σχολίων.
 *
 * @module ui/table-cell-editor/use-table-cursor-commands
 * @see useTableCellDoubleClickEditor — ο καταναλωτής, και το κριτήριο του διαχωρισμού
 */

import { useCallback } from 'react';
import type { TableEntity } from '../../types/table-entity';
import type { TableCellCursorState } from '../../state/table-cell-cursor-store';
import { activateTableCellLink } from '../../bim/table/table-link-interaction-2d';
import { openTableLinkPicker } from '../../state/table-link-picker-store';
import { toggleTableFormulaAbsoluteRef } from './table-point-mode-keys';

export interface TableCursorCommands {
  /** `Alt+Enter` — άνοιξε τη διεύθυνση του κελιού του δρομέα. */
  openCursorCellLink: () => void;
  /** `F4` — κλείδωσε/ξεκλείδωσε την αναφορά του δρομέα. */
  toggleAbsoluteRef: () => void;
}

export function useTableCursorCommands(
  liveEntity: TableEntity | null,
  cursor: TableCellCursorState | null,
): TableCursorCommands {
  /**
   * ADR-751 Φ8.γ — `Alt+Enter`: άνοιξε τη διεύθυνση του κελιού του δρομέα (Google Sheets).
   *
   * Η `ambiguous` δεν ανοίγει τίποτα — **ρωτά**. Κελί με δύο διευθύνσεις δεν έχει μία σωστή
   * απάντηση, και το να διαλέγαμε την πρώτη θα καλούσε λάθος άνθρωπο σιωπηλά.
   */
  const openCursorCellLink = useCallback(() => {
    if (!liveEntity || !cursor) return;
    const { rowId, colId } = cursor.position;
    const outcome = activateTableCellLink(liveEntity, rowId, colId);
    if (outcome.kind === 'ambiguous') {
      openTableLinkPicker({ links: outcome.links, scope: 'cell' });
    }
  }, [liveEntity, cursor]);

  /**
   * 🔴 ADR-754 Γ3 — `F4`: κλείδωσε/ξεκλείδωσε την αναφορά του δρομέα.
   *
   * Δηλώνεται **μία** φορά και όχι μέσα στα δύο πεδία επειδή τα δύο πεδία οφείλουν να κάνουν
   * το ίδιο πράγμα: δύο κατασκευές του ίδιου χειριστή θα ήταν sibling clone (CHECK 3.28) και
   * δύο ευκαιρίες να αποκλίνουν. Ίδια στάση με το `onCommit` και το `onMove`.
   */
  const toggleAbsoluteRef = useCallback(() => {
    if (!liveEntity || !cursor) return;
    toggleTableFormulaAbsoluteRef(liveEntity, cursor.draft);
  }, [liveEntity, cursor]);

  return { openCursorCellLink, toggleAbsoluteRef };
}
