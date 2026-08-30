'use client';

/**
 * ADR-739 §52 — **οι δομικές πράξεις της καρτέλας «Ιδιότητες Πίνακα»**: στυλ, γραμμές/στήλες,
 * επιλογή όλων.
 *
 * ## 🔴 Καμία νέα πράξη — ΜΟΝΟ νέα πόρτα
 * Κάθε γραμμή εδώ δείχνει σε κώδικα που **υπάρχει ήδη** και έχει δικά του tests:
 *
 * ```
 *   στυλ            → buildTableStyleCommand        (bim/table/table-cell-edit-session)
 *   εισαγωγή/διαγρ. → insertAt / deleteAxisTarget   (table-header-axis-actions)  ← καθαροί σχεδιαστές
 *                     + useTableAxisActionApply     (§42, ο ΕΝΑΣ εκτελεστής + επιζών δρομέας)
 *   ποιοι άξονες;   → resolveTableAxisActionTarget  (§27.17, ο ΕΝΑΣ κανόνας)
 *   επιλογή όλων    → selectWholeTable              (§43, ο ΕΝΑΣ γραφέας)
 * ```
 *
 * Ό,τι είναι όντως καινούριο είναι **η ερώτηση** που κάνει η κορδέλα: το μενού των ζωνών ρωτά
 * «ποιοι άξονες αφορούν αυτό το **γράμμα**;» — η κορδέλα δεν έχει γράμμα, έχει **δρομέα**.
 * Η μετάφραση είναι μία γραμμή ({@link axisTargetOf} πάνω στο ενεργό κελί) και ζει εδώ.
 *
 * ## 🔴 Γιατί οι δομικές πράξεις χρειάζονται δρομέα, ενώ το στυλ όχι
 * Το στυλ είναι ιδιότητα **της οντότητας** — έχει νόημα με σκέτη επιλογή πίνακα. Η «Εισαγωγή
 * γραμμής» χρειάζεται απάντηση στο «**ποιας** γραμμής;», και μόνο ο δρομέας τη δίνει. Είναι
 * ακριβώς η διάκριση του Excel: η κορδέλα δείχνει τις εντολές γραμμών/στηλών, αλλά εννοούν
 * πάντα την **τρέχουσα επιλογή κελιών**. Η καρτέλα το κάνει ορατό κρύβοντας τα δύο panels
 * χωρίς δρομέα (`visibilityKey`), αντί να δείχνει κουμπιά που δεν ξέρουν πού να γράψουν.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-structure-actions
 * @see ui/table-cell-editor/table-format-port.ts — η θύρα που τα δημοσιεύει
 */

import { useCallback, useMemo } from 'react';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { buildTableStyleCommand } from '../../bim/table/table-cell-edit-session';
import {
  axisTargetOf,
  resolveTableAxisActionTarget,
  type TableAxisActionTarget,
} from '../../bim/table/table-axis-action-target';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import {
  autoFitAxisHeight,
  canAutoFitAxisHeight,
  canDeleteAxisTarget,
  deleteAxisTarget,
  insertAt,
  type AxisActionPlanner,
} from './table-header-axis-actions';
import { useTableAxisActionApply } from './use-table-axis-action-apply';
import { selectWholeTable } from './table-select-all-action';
import { getTableCellCursor } from '../../state/table-cell-cursor-store';
import { useCommandHistory } from '../../core/commands';
import type { TableStructurePort } from './table-format-port';
import type { TableEntity } from '../../types/table-entity';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';

export interface UseTableStructureActionsParams {
  readonly levelManager: LevelManagerLike;
  /** Ο πίνακας **τη στιγμή της κλήσης** — ποτέ στιγμιότυπο απόδοσης (ADR-040 κανόνας #2). */
  readonly table: () => TableEntity | null;
}

export function useTableStructureActions(
  params: UseTableStructureActionsParams,
): TableStructurePort {
  const { levelManager, table } = params;
  const { execute } = useCommandHistory();
  const applyAxisAction = useTableAxisActionApply({ levelManager, execute });

  /**
   * 🔴 §27.17 — **ποιους άξονες αφορά η εντολή**: τον έναν του δρομέα, ή ολόκληρη την επιλογή
   * αν είναι του ίδιου είδους. Ο ΕΝΑΣ κανόνας, ρωτημένος με το **ενεργό κελί** αντί με ζώνη.
   */
  const axisTarget = useCallback(
    (axis: 'row' | 'column'): TableAxisActionTarget | null => {
      const live = table();
      const cursor = getTableCellCursor();
      if (!live || !cursor) return null;
      const id = axis === 'row' ? cursor.position.rowId : cursor.position.colId;
      return resolveTableAxisActionTarget(
        resolveTableModel(activeTableModel(live)),
        axisTargetOf(axis, id),
        cursor.selection,
      );
    },
    [table],
  );

  const runAxisAction = useCallback(
    (axis: 'row' | 'column', planner: AxisActionPlanner) => {
      const live = table();
      const target = axisTarget(axis);
      if (!live || !target) return;
      const { mutate, pick } = planner(target);
      applyAxisAction(live, mutate, pick);
    },
    [table, axisTarget, applyAxisAction],
  );

  return useMemo<TableStructurePort>(
    () => ({
      styleId: () => table()?.styleId ?? null,
      /**
       * ⚠️ **Δεν** περνά από το `useLiveTableMutation`: εκείνο γράφει `model`, εδώ γράφεται
       * `styleId` της οντότητας. Ο φύλακας του no-op ζει στο {@link buildTableStyleCommand} —
       * «διάλεξα το στυλ που είχα ήδη» δεν γεννά βήμα αναίρεσης.
       */
      setStyleId: (styleId) => {
        const live = table();
        const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
        if (!live || !currentLevelId || !setLevelScene) return;
        const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
        const command = buildTableStyleCommand(live, styleId, sceneManager);
        if (command) execute(command);
      },
      insertAxis: (axis, side) => runAxisAction(axis, insertAt(side)),
      deleteAxis: (axis) => runAxisAction(axis, deleteAxisTarget),
      canDeleteAxis: (axis) => {
        const live = table();
        const target = axisTarget(axis);
        return live !== null && target !== null && canDeleteAxisTarget(activeTableModel(live), target);
      },
      // 🔴 ADR-739 §58 Γ2 — **ο ίδιος στόχος με τη «Διαγραφή γραμμής»** (§27.17), ο ίδιος
      // εκτελεστής (§42). Δεύτερος κανόνας επιλογής γραμμών θα σήμαινε ότι το ίδιο μαρκάρισμα
      // δίνει άλλες γραμμές σε δύο κουμπιά που κάθονται δίπλα-δίπλα στο ίδιο panel.
      autoFitRowHeight: () => runAxisAction('row', autoFitAxisHeight),
      canAutoFitRowHeight: () => {
        const live = table();
        const target = axisTarget('row');
        return live !== null && target !== null && canAutoFitAxisHeight(activeTableModel(live), target);
      },
      selectAll: () => {
        const live = table();
        if (live) selectWholeTable(resolveTableModel(activeTableModel(live)));
      },
    }),
    [table, levelManager, execute, axisTarget, runAxisAction],
  );
}
