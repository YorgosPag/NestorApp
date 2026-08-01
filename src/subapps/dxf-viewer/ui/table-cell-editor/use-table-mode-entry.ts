'use client';

/**
 * ADR-739 Φ.Δ βήμα 4 — **οι δρόμοι εισόδου στη λειτουργία πίνακα που δεν είναι το ποντίκι**.
 *
 * Το διπλό κλικ ζει στον `useTableCellDoubleClickEditor` και **δεν** μετακομίζει εδώ: εκείνο
 * έχει **σημείο** (ξέρει ποιο κελί και ποιον χαρακτήρα έδειξες) και γι' αυτό ανοίγει σε
 * κατάσταση `edit` με κέρσορα στο γράμμα. Εδώ ζουν οι δύο είσοδοι **χωρίς σημείο**:
 *
 * | Είσοδος | Κατάσταση | Ποιος το κάνει έτσι |
 * |---|---|---|
 * | `Enter` σε επιλεγμένο πίνακα | `nav` στο πρώτο κελί | WAI-ARIA APG «Grid», Excel |
 * | `F2` σε επιλεγμένο πίνακα | `edit` στο πρώτο κελί | WAI-ARIA APG «Grid», Excel |
 * | εντολή `TABLEDIT` / `TE` | `nav` στο πρώτο κελί | AutoCAD `TABLEDIT` |
 *
 * Η κατά APG διάκριση δεν είναι λεπτομέρεια: το `Enter` σημαίνει «μπες στο πλέγμα» και το
 * `F2` «μπες να **διορθώσεις**». Με το ίδιο αποτέλεσμα και τα δύο, το `F2` δεν θα σήμαινε
 * τίποτα — ακριβώς το ίδιο επιχείρημα που γέννησε τη διάκριση `enter`/`edit` στο βήμα 2.
 *
 * ## 🔴 Γιατί φάση **bubble** και έλεγχος `defaultPrevented`
 * Το `Enter` είναι από τα πιο διεκδικούμενα πλήκτρα του viewer (Dynamic Input, δρομολόγηση
 * διαστάσεων, γραμμή εντολών, ροές εργαλείων πολλών κλικ). Ο wrapper προεπιλέγει **capture**,
 * δηλαδή θα έτρεχε **πρώτος** και θα έκλεβε το `Enter` από μια ροή σε εξέλιξη. Με bubble +
 * `defaultPrevented` η είσοδος στον πίνακα είναι ρητά **τελευταία στη σειρά**: δρα μόνο όταν
 * κανείς άλλος δεν διεκδίκησε το πλήκτρο. Ίδιο σκεπτικό με τον splitter του ADR-724, από την
 * ανάποδη πλευρά.
 *
 * ## Τι ΔΕΝ κάνει
 * Δεν δηλώνει scope και δεν αγγίζει το πληκτρολόγιο του πίνακα: μόλις γεννηθεί ο δρομέας,
 * ιδιοκτήτης είναι ο `useTableCellDoubleClickEditor` (`useModalKeyboardScope`). Εδώ γίνεται
 * **μόνο** η γέννηση. Και γι' αυτό ακριβώς ο ίδιος ο φύλακας του wrapper κάνει αυτόν τον
 * listener να σιωπά μόλις μπεις μέσα — καμία δεύτερη είσοδος πάνω στην είσοδο.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-mode-entry
 * @see ui/table-cell-editor/useTableCellDoubleClickEditor.ts — η είσοδος **με** σημείο
 * @see systems/command-line/CommandActionRegistry.ts — από πού έρχεται το `TABLEDIT`
 */

import { useCallback, useEffect } from 'react';
import { addGlobalShortcutListener } from '../../keyboard/global-shortcut-listener';
import { registerCommandAction } from '../../systems/command-line/CommandActionRegistry';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { tableFirstCursorPosition } from '../../bim/table/table-cell-navigation';
import {
  getTableCellCursor,
  setTableCellCursor,
  type TableCellCursorMode,
} from '../../state/table-cell-cursor-store';
import { resolveSelectedTable } from './table-entity-lookup';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

interface UseTableModeEntryParams {
  readonly getSelectedEntityIds: () => readonly string[];
  readonly levelManager: LevelManagerLike;
}

export interface TableModeEntry {
  /**
   * Άνοιξε τη λειτουργία πίνακα στο πρώτο κελί. `false` όταν δεν υπάρχει μονοσήμαντος
   * επιλεγμένος πίνακας, όταν ο πίνακας δεν έχει κελί, ή όταν είσαι **ήδη** μέσα.
   */
  readonly enterTableMode: (mode: TableCellCursorMode) => boolean;
}

export function useTableModeEntry(params: UseTableModeEntryParams): TableModeEntry {
  const { getSelectedEntityIds, levelManager } = params;

  const enterTableMode = useCallback(
    (mode: TableCellCursorMode): boolean => {
      // Είσαι ήδη μέσα: η δεύτερη είσοδος θα πετούσε τον δρομέα πίσω στο πρώτο κελί,
      // δηλαδή θα έχανε τη θέση του χρήστη. Το `Enter` εκεί ανήκει στην πλοήγηση.
      if (getTableCellCursor() !== null) return false;

      const entity = resolveSelectedTable(levelManager, getSelectedEntityIds);
      if (!entity) return false;

      // Το ίδιο απομνημονευμένο (WeakMap) μονοπάτι που περνά και η γεωμετρία — ίδιο
      // persisted ⇒ ίδιο μοντέλο, καμία δεύτερη αποσειριοποίηση.
      const position = tableFirstCursorPosition(resolveTableModel(entity.model));
      if (!position) return false;

      // Πρόχειρο `''` και σε `edit`: μπαίνεις σε **άδειο** πεδίο, όπως και με `Tab`. Το
      // δεσμευμένο κείμενο το σπέρνει το `F2` **μέσα** στον επεξεργαστή (`setTableCellCursorMode`
      // με `initialText`), και είναι σωστό να μένει εκεί — αλλιώς θα υπήρχαν δύο σημεία που
      // ξέρουν «από πού ξεκινά το πρόχειρο», ένα εκ των οποίων χωρίς πρόσβαση στο κελί.
      setTableCellCursor(entity.id, position, mode);
      return true;
    },
    [getSelectedEntityIds, levelManager],
  );

  // ── `Enter` / `F2` πάνω σε επιλεγμένο πίνακα ──────────────────────────────────
  useEffect(() => {
    return addGlobalShortcutListener(
      (event) => {
        if (event.defaultPrevented) return;
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

        const mode: TableCellCursorMode | null =
          event.key === 'Enter' ? 'nav' : event.key === 'F2' ? 'edit' : null;
        if (!mode) return;

        // `preventDefault` **μόνο** αν όντως μπήκαμε: ένα `Enter` που δεν άνοιξε πίνακα
        // οφείλει να συνεχίσει τον δρόμο του άθικτο.
        if (enterTableMode(mode)) event.preventDefault();
      },
      { capture: false },
    );
  }, [enterTableMode]);

  // ── Η εντολή `TABLEDIT` / `TE` ────────────────────────────────────────────────
  useEffect(() => {
    return registerCommandAction('table.edit', {
      // Το `canRun` ρωτά **τη στιγμή της εντολής**, όχι σε render: η επιλογή μπορεί να
      // άλλαξε αφότου στήθηκε ο εκτελεστής.
      canRun: () => getTableCellCursor() === null
        && resolveSelectedTable(levelManager, getSelectedEntityIds) !== null,
      // AutoCAD `TABLEDIT`: σε **πλοήγηση**, όχι σε γραφή — η εντολή δεν είπε ποιο κελί.
      run: () => { enterTableMode('nav'); },
    });
  }, [enterTableMode, getSelectedEntityIds, levelManager]);

  return { enterTableMode };
}
