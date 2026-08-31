'use client';

/**
 * 🔴 ADR-833 Φάση 4 — **ποιος ανοίγει το μενού καρτέλας και με ποιον στόχο.**
 *
 * ## 🔑 Ο στόχος διαβάζεται από το hover store και ΔΕΝ ξαναϋπολογίζεται
 * Ίδια απόφαση —και ίδιος λόγος— με το `use-table-link-menu`: η απάντηση **υπάρχει ήδη**. Το
 * `table-indicator-hover-store` κρατά την καρτέλα κάτω από τον δείκτη — είναι αυτή που ο
 * χρήστης βλέπει **φωτισμένη** τη στιγμή που πατά δεξί κλικ, και η ίδια που θα εκτελούσε ένα
 * αριστερό κλικ (`use-table-worksheet-tab-click`).
 *
 * Ένας δεύτερος επιλυτής εδώ θα ήταν δεύτερη απάντηση στο «ποια καρτέλα είναι εδώ», και το
 * «σχεδόν πάντα ίδια» έχει σε αυτή τη λωρίδα συγκεκριμένο όνομα: το **παράθυρο υπερχείλισης**
 * είναι συνάρτηση του zoom, οπότε αρκεί μια κίνηση τροχού ανάμεσα στην τελευταία κίνηση και το
 * πάτημα για να απαντήσει αλλιώς. Ο χρήστης θα άνοιγε μενού για φύλλο που δεν στόχευσε — και
 * το πρώτο του item είναι **διαγραφή**.
 *
 * ## 🔴 ΤΟ ΔΕΞΙ ΚΛΙΚ ΕΝΕΡΓΟΠΟΙΕΙ ΠΡΩΤΑ ΤΗΝ ΚΑΡΤΕΛΑ — Excel/Sheets parity, και είναι ασφάλεια
 * Και τα δύο εργαλεία κάνουν το φύλλο **τρέχον** πριν ανοίξουν το μενού του. Δεν είναι
 * σύμβαση ευγένειας: το μενού περιέχει **καταστροφική** εντολή, και ο μόνος τρόπος να δει ο
 * χρήστης *τι* θα χάσει είναι να το έχει μπροστά του. Χωρίς την ενεργοποίηση, ένα «Διαγραφή
 * φύλλου» πάνω σε καρτέλα που **δεν** δείχνει ο πίνακας είναι διαγραφή στα τυφλά.
 *
 * ⚠️ Η ενεργοποίηση περνά από τον **υπάρχοντα** γραφέα χωρίς ιστορικό (`applyTableScenePatch`),
 * όχι από εντολή: παραμένει ό,τι ήταν στη Φάση 3 — αλλαγή του **ποιο βλέπεις**, όχι του **τι
 * υπάρχει**. Ένα `Ctrl+Z` μετά τη διαγραφή επαναφέρει το φύλλο, όχι τη ματιά.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-worksheet-menu
 * @see ui/components/TableWorksheetContextMenu.tsx — η επιφάνεια (και οι πέντε εντολές)
 * @see bim/table/table-worksheet-ops.ts — οι καθαροί σχεδιαστές των πράξεων
 */

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useCommandHistory } from '../../core/commands';
import { getTableIndicatorHover } from '../../state/table-indicator-hover-store';
import { planWorksheetActivation } from '../../bim/table/table-worksheet-activate';
import {
  planWorksheetDelete,
  planWorksheetMove,
} from '../../bim/table/table-worksheet-ops';
import { worksheetMenuState } from '../../bim/table/table-worksheet-menu-state';
import { worksheetDisplayName } from '../../bim/table/table-worksheet-name';
import { resolveWorksheets } from '../../bim/table/table-worksheet-resolve';
import { tableCursorFor } from '../../state/table-cell-cursor-scope';
import { applyTableScenePatch } from './table-scene-patch';
import { resolveTableById } from './table-entity-lookup';
import { openWorksheetRenameById } from './table-worksheet-rename-open';
import { useTableWorksheetAdd, useTableWorksheetApply } from './use-table-worksheet-apply';
import {
  getTableWorksheetMenuPort,
  setTableWorksheetMenuPort,
  type TableWorksheetMenuPort,
} from './table-worksheet-menu-port';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { ViewTransform } from '../../rendering/types/Types';
import type {
  TableWorksheetContextMenuHandle,
  TableWorksheetMenuProps,
  TableWorksheetMenuTarget,
} from '../components/TableWorksheetContextMenu';

export interface UseTableWorksheetMenuParams {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly transformRef: RefObject<ViewTransform>;
  readonly levelManager: LevelManagerLike;
}

export interface TableWorksheetMenuMount {
  readonly ref: RefObject<TableWorksheetContextMenuHandle | null>;
  readonly props: TableWorksheetMenuProps;
}

export function useTableWorksheetMenu(
  params: UseTableWorksheetMenuParams,
): TableWorksheetMenuMount {
  const { containerRef, transformRef, levelManager } = params;
  const { execute } = useCommandHistory();
  const applyWorksheet = useTableWorksheetApply({ levelManager, execute });
  const addWorksheet = useTableWorksheetAdd({ levelManager, execute });
  const menuRef = useRef<TableWorksheetContextMenuHandle | null>(null);

  /**
   * Ο πίνακας του **hover**, τη στιγμή της κλήσης· `null` όταν ο δείκτης δεν στέκεται σε
   * καρτέλα ή ο πίνακας χάθηκε από κάτω του.
   *
   * ⚠️ **Όχι** `useLiveTable`: εκείνο ρωτά τον **δρομέα**, και η λωρίδα ζει και σε **απλή
   * επιλογή** — χωρίς δρομέα. Το μενού θα ήταν νεκρό ακριβώς στην κατάσταση όπου η λωρίδα
   * είναι πιο ορατή.
   */
  const hoveredTable = useCallback(() => {
    const hover = getTableIndicatorHover();
    if (hover?.target.kind !== 'worksheet-tab') return null;
    const live = resolveTableById(levelManager, hover.entityId);
    return live ? { live, worksheetId: hover.target.worksheetId } : null;
  }, [levelManager]);

  /**
   * Μία θέση αριστερά ή δεξιά — **απόλυτη** θέση προς τον σχεδιαστή, όχι κατεύθυνση.
   *
   * Ο δείκτης ξαναδιαβάζεται από τη **ζωντανή** οντότητα και δεν έρχεται από τον στόχο: το
   * μενού μπορεί να είναι ανοιχτό όσο ένα `Ctrl+Z` αναδιατάσσει από κάτω, και μια μετακίνηση
   * με μπαγιάτικο δείκτη θα πήγαινε το φύλλο σε θέση που κανείς δεν έδειξε.
   */
  const moveBy = useCallback(
    (step: number, target: TableWorksheetMenuTarget): void => {
      const hovered = hoveredTable();
      if (!hovered) return;
      const index = resolveWorksheets(hovered.live).findIndex((sheet) => sheet.id === target.worksheetId);
      if (index < 0) return;
      applyWorksheet(hovered.live, planWorksheetMove(hovered.live, target.worksheetId, index + step));
    },
    [applyWorksheet, hoveredTable],
  );

  const actions = useMemo<TableWorksheetMenuProps>(
    () => ({
      // Το «Νέο φύλλο» δεν χρειάζεται στόχο: πάει **πάντα** στο τέλος (Απόφαση 1). Η ίδια
      // σημασιολογία με το ⊕ της λωρίδας — μία απάντηση στο «πού πάει το νέο φύλλο».
      onAdd: () => {
        const hovered = hoveredTable();
        // 🔴 ADR-833 Φ5Β — **ο ΕΝΑΣ δρόμος προσθήκης φύλλου**, ίδιος με το ⊕ της λωρίδας:
        // σχεδιάζει, εφαρμόζει, και **λέει με αριθμό** όταν ο πίνακας δεν χωρά άλλο. Δύο
        // αντίγραφα της ίδιας τριάδας θα ήταν ο sibling clone του N.18 — και, ως συνήθως,
        // το ακριβό δεν είναι οι γραμμές: το δεύτερο αντίγραφο θα ξεχνούσε το **μήνυμα**.
        if (hovered) addWorksheet(hovered.live);
      },
      onRename: (target) => {
        const hovered = hoveredTable();
        const container = containerRef.current;
        const transform = transformRef.current;
        if (!hovered || !container || !transform) return;
        openWorksheetRenameById({
          entity: hovered.live,
          worksheetId: target.worksheetId,
          container,
          transform,
        });
      },
      onMoveLeft: (target) => moveBy(-1, target),
      onMoveRight: (target) => moveBy(1, target),
      onDelete: (target) => {
        const hovered = hoveredTable();
        if (!hovered) return;
        // 🔴 Ο δρομέας διαβάζεται με τον **ΕΝΑ** φύλακα, τη στιγμή της πράξης: αν ο χρήστης
        // ήταν μέσα στον πίνακα, ο δρομέας πρέπει να προσγειωθεί στον **διάδοχο** — αλλιώς
        // μένει δεμένος σε φύλλο που δεν υπάρχει πια και κάθε βέλος πέφτει στο κενό.
        const cursor = tableCursorFor(hovered.live)?.position ?? null;
        applyWorksheet(hovered.live, planWorksheetDelete(hovered.live, target.worksheetId, cursor));
      },
    }),
    [addWorksheet, applyWorksheet, hoveredTable, moveBy, containerRef, transformRef],
  );

  useEffect(() => {
    const port: TableWorksheetMenuPort = {
      open: (x, y) => {
        const hover = getTableIndicatorHover();
        if (hover?.target.kind !== 'worksheet-tab') return false;
        const live = resolveTableById(levelManager, hover.entityId);
        if (!live) return false;
        const { worksheetId } = hover.target;
        const state = worksheetMenuState(live, worksheetId);
        if (!state) return false;

        // 🔴 Δες την κεφαλίδα: **πρώτα ενεργοποίηση**, ώστε το μενού να μιλά για το φύλλο που
        // ο πίνακας δείχνει. `null` σημαίνει «ήταν ήδη το ενεργό» — τότε δεν γράφεται τίποτα.
        const activation = planWorksheetActivation(live, worksheetId, tableCursorFor(live)?.position ?? null);
        if (activation) applyTableScenePatch(levelManager, live, activation.patch);

        const sheet = resolveWorksheets(live)[state.index];
        menuRef.current?.open(x, y, {
          worksheetId,
          // Το **ορατό** όνομα, από τον ΕΝΑ επιλυτή: ο τίτλος του μενού και η ετικέτα της
          // καρτέλας δεν επιτρέπεται να διαφωνήσουν για το πώς λέγεται το φύλλο.
          name: worksheetDisplayName(sheet, state.index),
          canAdd: state.canAdd,
          canDelete: state.canDelete,
          canMoveLeft: state.canMoveLeft,
          canMoveRight: state.canMoveRight,
        });
        return true;
      },
    };
    setTableWorksheetMenuPort(port);
    // Έλεγχος ταυτότητας στο cleanup, ίδιος λόγος με τις αδελφές θύρες: σε διπλό mount το
    // cleanup του παλιού δεν επιτρέπεται να σβήσει τη θύρα που μόλις έγραψε ο νέος.
    return () => {
      if (getTableWorksheetMenuPort() === port) setTableWorksheetMenuPort(null);
    };
  }, [levelManager]);

  return useMemo(() => ({ ref: menuRef, props: actions }), [actions]);
}
