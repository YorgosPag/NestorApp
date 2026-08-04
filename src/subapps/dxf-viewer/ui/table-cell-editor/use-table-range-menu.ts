'use client';

/**
 * ADR-750 Φάση 4 — **ποιος ανοίγει το μενού περιγραμμάτων και με ποιον στόχο**.
 *
 * ## 🔑 Α22 — ο στόχος είναι το κελί, ΕΚΤΟΣ αν ανήκει στην επιλογή
 * ```
 * επιλογή B2:D4, δεξί κλικ στο C3  ⇒  στόχος B2:D4   (μέσα στην επιλογή)
 * επιλογή B2:D4, δεξί κλικ στο E5  ⇒  στόχος E5      (έξω από αυτήν)
 * καμία επιλογή,  δεξί κλικ στο E5  ⇒  στόχος E5
 * ```
 * Είναι **ακριβώς η σημασιολογία του Excel**, χωρίς την παρενέργειά του. Το Excel τη
 * συμπεραίνει *μετακινώντας* την επιλογή στο κελί που πατήθηκε· εδώ το δεξί κλικ δεν αγγίζει
 * ποτέ την επιλογή (ADR-739 §27.14: «το δεξί σταματά εδώ»), οπότε ο ίδιος κανόνας βγαίνει από
 * την **ερώτηση** αντί από τη μεταβολή. Ο χρήστης βλέπει την επιλογή του ανέπαφη και ξέρει τι
 * θα βαφτεί επειδή ο τίτλος του μενού το γράφει.
 *
 * ⚠️ Η εναλλακτική «πάντα η τρέχουσα επιλογή» απορρίφθηκε ως **ψέμα**: δεξί κλικ στο E5 θα
 * έβαφε το B2:D4, δηλαδή μακριά από τον δείκτη, χωρίς καμία ένδειξη.
 *
 * ## Δώρο από τον ΕΝΑ δρόμο: η συγχώνευση λύνεται μόνη της
 * Το μεμονωμένο κελί περνά από το `resolveTableSelectionBounds` με είδος `'range'`, δηλαδή
 * **κουμπώνει σε ολόκληρη συγχώνευση** (ADR-739 §26.5). Δεξί κλικ σε συγχωνευμένο κελί δίνει
 * περίγραμμα γύρω από **όλη** τη συγχώνευση, χωρίς μία γραμμή ειδικής λογικής εδώ.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-range-menu
 * @see ui/components/TableRangeContextMenu.tsx — η επιφάνεια
 * @see ui/table-cell-editor/use-table-border-actions.ts — οι πράξεις (κοινές με τη Φ3)
 */

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { columnLetter } from '@/lib/spreadsheet/column-letter';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import {
  resolveTableSelectionBounds,
  type TableCellRangeBounds,
  type TableCellRef,
  type TableSelectionSpan,
} from '../../bim/table/table-cell-range';
import {
  tableEventWorldPoint,
  tablePointerHitAtWorld,
} from './table-cell-pointer-hit';
import {
  getTableCellCursor,
  restartTableCellCursorSession,
} from '../../state/table-cell-cursor-store';
// 🔴 ADR-739 §43 — ο ΕΝΑΣ γραφέας του «επίλεξε τα πάντα». Δες το σκεπτικό στο `resolveTarget`
// για το γιατί το **δεξί** κλικ επιτρέπεται να γράψει, σε αντίθεση με κάθε άλλη διαδρομή.
import { selectWholeTable } from './table-select-all-action';
import { useLiveTable } from './use-live-table';
import { useTableBorderActions } from './use-table-border-actions';
import { useTableMergeActions } from './use-table-merge-actions';
import {
  getTableRangeMenuPort,
  setTableRangeMenuPort,
  type TableRangeMenuPort,
} from './table-range-menu-port';
import type {
  TableRangeContextMenuHandle,
  TableRangeMenuProps,
  TableRangeMenuTarget,
} from '../components/TableRangeContextMenu';
import type { TableModel } from '../../types/table';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { ViewTransform } from '../../rendering/types/Types';

export interface UseTableRangeMenuParams {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly transformRef: RefObject<ViewTransform>;
  readonly levelManager: LevelManagerLike;
}

export interface TableRangeMenuMount {
  readonly ref: RefObject<TableRangeContextMenuHandle | null>;
  readonly props: TableRangeMenuProps;
}

export function useTableRangeMenu(params: UseTableRangeMenuParams): TableRangeMenuMount {
  const { containerRef, transformRef, levelManager } = params;
  const menuRef = useRef<TableRangeContextMenuHandle | null>(null);
  const liveTable = useLiveTable(levelManager);
  const borderActions = useTableBorderActions({ levelManager, liveTable });
  const mergeActions = useTableMergeActions({ levelManager, liveTable });

  /**
   * 🔑 Ό,τι ξέρει το μενού για μια περιοχή, σε **μία** ερώτηση.
   *
   * Ξεχωριστό από το {@link resolveTarget} επειδή το ζητούν **δύο** διαφορετικά γεγονότα: το
   * άνοιγμα (που πρώτα πρέπει να βρει *ποια* περιοχή) και η **ανανέωση μετά από εντολή** (που
   * την ξέρει ήδη). Χωρίς τον διαχωρισμό, η ανανέωση θα ξανάκανε hit-test σε συντεταγμένες που
   * δεν έχει — ή θα αντέγραφε το σώμα, δηλαδή δύο απαντήσεις στο «τι δείχνει το κουμπί».
   */
  const describeTarget = useCallback(
    (bounds: TableCellRangeBounds): TableRangeMenuTarget => ({
      bounds,
      label: rangeLabel(bounds),
      canReset: borderActions.canReset(bounds),
      canClearDiagonals: borderActions.canClearDiagonals(bounds),
      merge: mergeActions.resolveState(bounds),
      borders: {
        canReset: borderActions.canReset(bounds),
        canClearDiagonals: borderActions.canClearDiagonals(bounds),
        onApply: (id) => borderActions.applyCommand(bounds, id),
        onReset: () => borderActions.resetBorders(bounds),
        onApplyDiagonal: (id) => borderActions.applyDiagonal(bounds, id),
        resolvePencil: borderActions.resolvePencil,
        // ADR-750 Φ6 — ο διάλογος ξαναρωτά τα **ίδια** όρια τη στιγμή του ανοίγματος: ένα undo
        // ενόσω το μενού ήταν ανοιχτό σημαίνει «δεν ανοίγει», ποτέ διάλογος πάνω σε φάντασμα.
        moreBorders: {
          resolveTarget: () => borderActions.resolveDialogTarget(bounds),
          onCommit: borderActions.commitModel,
        },
      },
    }),
    [borderActions, mergeActions],
  );

  /**
   * Ο στόχος του δεξιού κλικ· `null` όταν δεν έπεσε σε κελί —ή στη γωνία— ζωντανού πίνακα.
   *
   * ## 🔴 ADR-739 §43 — Η ΜΙΑ ΠΑΡΕΝΕΡΓΕΙΑ, ΡΗΤΗ ΚΑΙ ΜΕΤΡΗΜΕΝΗ
   * Ο κλάδος της γωνίας **γράφει** την επιλογή πριν επιστρέψει, και είναι η **μόνη** διαδρομή
   * δεξιού κλικ σε ολόκληρο τον πίνακα που το κάνει. Είναι απόκλιση από τον κανόνα του §27.14
   * («*το δεξί σταματά εδώ: δήλωσε και παραδώσου*») και από τον Α22 της κεφαλίδας («*ο στόχος
   * βγαίνει από την **ερώτηση** αντί από τη μεταβολή*») — και μπήκε ως **συνειδητή εξαίρεση**,
   * όχι από παράβλεψη:
   *
   *  - **μετρήθηκε στο πραγματικό Excel** (Giorgio, 04/08): με ενεργή επιλογή `B2:C4`, δεξί
   *    κλικ στο τετραγωνάκι ⇒ *«χάθηκε η επιλογή σου κι επιλέχθηκε όλο το φύλλο»*·
   *  - ο ιδιοκτήτης επέλεξε ρητά **full parity** αφού του παρουσιάστηκε η σύγκρουση.
   *
   * ⚠️ Ο λόγος που ο Α22 **δεν** αρκούσε εδώ είναι πραγματικός, όχι τυπικός: η γωνία είναι
   * **κουμπί**, όχι θέση. Ένα μενού με τίτλο `A1:E7` πάνω από μια οθόνη που δείχνει ακόμα
   * μαρκαρισμένο το `B2:C4` λέει δύο πράγματα ταυτόχρονα — και ο Α22 στηρίζεται ακριβώς στο ότι
   * ο τίτλος **συμφωνεί** με ό,τι φαίνεται.
   *
   * Η γραφή περνά από τον **ΕΝΑ** γραφέα ({@link selectWholeTable}), τον ίδιο που εκτελεί το
   * `Ctrl+A` και το αριστερό κλικ — και τα όρια που τιτλοφορούν το μενού είναι **αυτά που
   * γράφτηκαν**, όχι δεύτερος υπολογισμός τους.
   */
  const resolveTarget = useCallback(
    (clientX: number, clientY: number): TableRangeMenuTarget | null => {
      const live = liveTable();
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!live || !container || !transform) return null;

      const world = tableEventWorldPoint({ clientX, clientY }, container, transform);
      if (!world) return null;
      const hit = tablePointerHitAtWorld(live, world, transform.scale);
      const model = resolveTableModel(live.model);

      // 🔴 §43 — το τετραγωνάκι της γωνίας. Το Excel δείχνει εκεί το μενού **ΚΕΛΙΟΥ**, όχι της
      // κεφαλίδας — μετρήθηκε στα δύο στιγμιότυπα της 04/08 και τα ξεχωρίζουν τα ίδια τα items
      // (η γωνία έχει «Έξυπνη αναζήτηση / Φίλτρο / Ταξινόμηση»· η στήλη έχει «Πλάτος στήλης /
      // Απόκρυψη»). Άρα ο στόχος είναι **περιοχή**, και το μενού είναι αυτό εδώ — κανένα νέο.
      if (hit?.where === 'select-all-corner') {
        const whole = selectWholeTable(model);
        return whole ? describeTarget(whole) : null;
      }

      // Ζώνη δείκτη και διαχωριστικό στηλών έχουν **δικούς τους** χειριστές σε προηγούμενη
      // προτεραιότητα· εδώ απαντάμε μόνο για κελιά.
      if (!hit || hit.where !== 'cell') return null;

      const bounds = tableBorderTargetBounds(
        model,
        { rowId: hit.cell.rowId, colId: hit.cell.colId },
        getTableCellCursor()?.selection,
      );
      if (!bounds) return null;

      return describeTarget(bounds);
    },
    [liveTable, containerRef, transformRef, describeTarget],
  );

  useEffect(() => {
    const port: TableRangeMenuPort = {
      open: (x, y) => {
        const target = resolveTarget(x, y);
        if (!target) return false;
        menuRef.current?.open(x, y, target);
        return true;
      },
    };
    setTableRangeMenuPort(port);
    // Έλεγχος ταυτότητας στο cleanup, ίδιος λόγος με τη θύρα των ζωνών: σε διπλό mount το
    // cleanup του παλιού δεν επιτρέπεται να σβήσει τη θύρα που μόλις έγραψε ο νέος.
    return () => {
      if (getTableRangeMenuPort() === port) setTableRangeMenuPort(null);
    };
  }, [resolveTarget]);

  const props = useMemo<TableRangeMenuProps>(
    () => ({
      onApplyBorder: (bounds, commandId) => borderActions.applyCommand(bounds, commandId),
      onResetBorders: (bounds) => borderActions.resetBorders(bounds),
      onApplyDiagonal: (bounds, commandId) => borderActions.applyDiagonal(bounds, commandId),
      // ADR-755 — επιστρέφει `Promise`: η συγχώνευση ρωτά πριν πετάξει περιεχόμενο, και ο
      // καλών περιμένει την απάντηση πριν ξαναρωτήσει την κατάσταση του κουμπιού.
      onApplyMerge: (bounds, commandId) => mergeActions.applyCommand(bounds, commandId),
      resolveTarget: describeTarget,
      // Το μενού έκλεισε — η εστίαση επιστρέφει στο κελί, αλλιώς η συνεδρία μένει ζωντανή στο
      // store αλλά κουφή στην οθόνη (ίδια σύμβαση με το μενού των ζωνών).
      onClosed: restartTableCellCursorSession,
    }),
    [borderActions, mergeActions, describeTarget],
  );

  return useMemo(() => ({ ref: menuRef, props }), [props]);
}

// ──────────────────────────────────────────────────────────────────────────────
// Καθαροί βοηθοί
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τα όρια που θα βαφτούν: η τρέχουσα επιλογή αν το κελί ανήκει σε αυτήν, αλλιώς το κελί μόνο
 * του. Και τα δύο περνούν από τον **ΕΝΑ** δρόμο ερμηνείας επιλογής (Α22, δες την κεφαλίδα).
 *
 * Η επιλογή περνά ως **όρισμα** και δεν διαβάζεται από το store εδώ μέσα: έτσι ο κανόνας Α22
 * είναι καθαρή συνάρτηση και ελέγχεται με τέσσερα σχήματα σε τέσσερις γραμμές, αντί να απαιτεί
 * στημένο store και προσποιητό δρομέα. Ο καλών κάνει την **μία** ανάγνωση, τη στιγμή του
 * συμβάντος (ADR-040 κανόνας #2).
 *
 * `null` όταν το κελί δεν υπάρχει στο μοντέλο — μπαγιάτικη αναφορά μετά από undo.
 */
export function tableBorderTargetBounds(
  model: TableModel,
  cell: TableCellRef,
  selection: TableSelectionSpan | null | undefined,
): TableCellRangeBounds | null {
  const cellBounds = resolveTableSelectionBounds(model, { from: cell, to: cell, kind: 'range' });
  if (!cellBounds) return null;

  const selected = selection ? resolveTableSelectionBounds(model, selection) : null;
  return selected && contains(selected, cellBounds) ? selected : cellBounds;
}

/** Περιέχει το `outer` ολόκληρο το `inner`; Σύγκριση ορθογωνίων σε δείκτες, τίποτα άλλο. */
function contains(outer: TableCellRangeBounds, inner: TableCellRangeBounds): boolean {
  return (
    outer.firstRow <= inner.firstRow
    && outer.lastRow >= inner.lastRow
    && outer.firstCol <= inner.firstCol
    && outer.lastCol >= inner.lastCol
  );
}

/**
 * `C3` για ένα κελί, `B2:D4` για περιοχή — **η γλώσσα του χρήστη** (Α5: δεν μαθαίνει ποτέ τη
 * λέξη «ακμή»). Το γράμμα βγαίνει από το ίδιο SSoT με τις ζώνες δείκτη (`columnLetter`), ώστε
 * ο τίτλος του μενού να λέει ακριβώς ό,τι δείχνει η λωρίδα από πάνω.
 */
export function rangeLabel(bounds: TableCellRangeBounds): string {
  const start = cellName(bounds.firstRow, bounds.firstCol);
  const end = cellName(bounds.lastRow, bounds.lastCol);
  return start === end ? start : `${start}:${end}`;
}

function cellName(rowIndex: number, colIndex: number): string {
  return `${columnLetter(colIndex)}${rowIndex + 1}`;
}
