'use client';

/**
 * 🔴 ADR-754 **Γ4** — **Η ΧΕΙΡΟΝΟΜΙΑ ΤΗΣ ΛΑΒΗΣ ΣΥΜΠΛΗΡΩΣΗΣ**: πιάσιμο, σύρσιμο, εκτέλεση.
 *
 * Το αδελφό του `table-point-mode-pointer.ts`, με την ίδια δομή και τον ίδιο καταμερισμό:
 *
 * | ερώτηση | ποιος απαντά |
 * |---|---|
 * | «πού κάθεται η λαβή, και τι υπόσχεται η σύρση;» | `bim/table/table-fill-handle.ts` (καθαρό) |
 * | «τι γίνεται το μοντέλο;» | `bim/table/table-fill-apply.ts` (καθαρό) |
 * | «πού έπεσε το χέρι, και ποιος γράφει;» | **εδώ** (DOM + store) |
 *
 * ## 🔴 Γιατί ΔΕΝ γράφεται εδώ δεύτερος βρόχος `mousemove`
 * Η σύρση της λαβής είναι η **ίδια χειρονομία** με τη σύρση επιλογής και με τη σύρση
 * υπόδειξης: κουμπί κάτω, ακολούθα το χέρι, γράψε **μόνο όταν αλλάζει κελί** (ADR-735),
 * συνέχισε στην άκρη με auto-pan, τερμάτισε στο `mouseup` όπου κι αν γίνει. Είναι ο **τρίτος
 * παραλήπτης** του ενός κύκλου ζωής (`table-cell-drag-session.ts`), όχι τρίτη μηχανή — δες
 * εκεί το `write` (ADR-754 §5) και το `onEnd` (Γ4).
 *
 * ## 🔴 Η ΣΥΡΣΗ ΔΕΙΧΝΕΙ, Η ΑΠΕΛΕΥΘΕΡΩΣΗ ΓΡΑΦΕΙ
 * Ανά κίνηση γράφεται **μόνο** το store προεπισκόπησης. Το μοντέλο γράφεται **μία φορά**, στο
 * `mouseup`. Ένα γράψιμο ανά κελί θα άφηνε δέκα βήματα undo για μία χειρονομία — και θα
 * ξαναϋπολόγιζε τον πίνακα δέκα φορές. Ίδια δομή με τη μεταφορά περιοχής (§36.15).
 *
 * ## Ρητό όριο: η λαβή δεν πιάνεται σε **γραφή**
 * Όσο ο χρήστης πληκτρολογεί, ο ζωγράφος δεν τη δείχνει (Excel parity) — και ο φρουρός εδώ
 * ρωτά το ίδιο. Είναι απαραίτητο, όχι διακοσμητικό: το `table-point-mode-pointer` τρέχει
 * **πριν** από αυτόν και διεκδικεί τα κλικ σε κελιά όσο γράφεται τύπος· δύο φρουροί με
 * διαφορετική άποψη για την ίδια στιγμή θα έδιναν «λαβή που πιάνεται αλλά δεν φαίνεται».
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-fill-handle-drag
 * @see ui/table-cell-editor/table-point-mode-pointer.ts — το αδελφό, ίδια δομή
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §13
 */

import type { RefObject } from 'react';
import { computeTableEntityGeometryLive, tablePxPerMm, tableWorldToFrame } from '../../bim/table/table-entity-geometry';
import { tableMmToWorldLive } from '../../bim/table/table-entity-geometry';
import {
  resolveTableSelectionBounds,
  type TableCellRangeBounds,
  type TableCellRef,
} from '../../bim/table/table-cell-range';
import {
  resolveTableFillTarget,
  tableFillHandleHitAtFrame,
  tableFillPreviewBounds,
  tableFillSourceBounds,
} from '../../bim/table/table-fill-handle';
import { applyTableFill } from '../../bim/table/table-fill-apply';
import { indexById, resolveTableModel } from '../../bim/table/table-model-helpers';
import { startTableCellDrag } from './table-cell-drag-session';
import { cellEndAt } from './table-pointer-axis-selection';
import { claimTableCellPointerGesture, claimTableCellSessionPointerDown } from './table-cell-session-focus';
import { setTableCellSelection, type TableCellCursorState } from '../../state/table-cell-cursor-store';
import { clearTableFillPreview, setTableFillPreview } from '../../state/table-fill-preview-store';
import type { TableEntity } from '../../types/table-entity';
import type { TableModel } from '../../types/table';
import type { ViewTransform } from '../../rendering/types/Types';

/** Ό,τι ξέρει ο φρουρός του ποντικιού τη στιγμή του πατήματος. */
export interface TableFillHandlePress {
  /** Η **ζωντανή** οντότητα του δρομέα. */
  readonly entity: TableEntity;
  readonly cursor: TableCellCursorState;
  /** Το σημείο του πατήματος σε **κόσμο** — η ίδια τιμή που ήδη υπολόγισε ο καλών. */
  readonly worldPoint: { readonly x: number; readonly y: number };
  readonly transform: ViewTransform;
  readonly container: HTMLElement;
  readonly transformRef: RefObject<ViewTransform>;
  /** Η **ΜΙΑ** διαδρομή εγγραφής μοντέλου — η ίδια που χρησιμοποιεί η μεταφορά περιοχής. */
  readonly commit: (entity: TableEntity, model: TableEntity['model']) => void;
}

/**
 * 🔴 **Ο ΦΡΟΥΡΟΣ.** `true` ⇒ αυτό το πάτημα ήταν η λαβή· την κατανάλωσε ολόκληρη και ο καλών
 * οφείλει να σταματήσει εκεί.
 *
 * `false` ⇒ ο κανονικός δρόμος τρέχει αυτούσιος. Η άρνηση είναι η **συνηθισμένη** έκβαση.
 */
export function tryTableFillHandleMouseDown(event: MouseEvent, press: TableFillHandlePress): boolean {
  if (event.button !== 0) return false;
  // Σε γραφή η λαβή δεν φαίνεται — δες το ρητό όριο στην κεφαλίδα.
  if (press.cursor.mode !== 'nav') return false;

  const model = resolveTableModel(press.entity.model);
  const source = fillSourceBounds(model, press.cursor);
  if (!source) return false;
  if (!isOnHandle(press, source)) return false;

  claimTableCellSessionPointerDown();
  claimTableCellPointerGesture();

  const anchor = cellAt(model, source.lastRow, source.lastCol);
  if (!anchor) return false;

  let target = resolveTableFillTarget(source, { row: source.lastRow, col: source.lastCol });
  startTableCellDrag({
    anchor,
    kind: 'range',
    container: press.container,
    resolveAt: (moveEvent) => cellEndAt(moveEvent, press.entity, press.container, press.transformRef),
    // ADR-754 §5 — ο **ίδιος** κύκλος ζωής, τρίτος παραλήπτης: γράφεται **μόνο** η υπόσχεση.
    write: (span) => {
      target = fillTargetOf(model, source, span.to);
      setTableFillPreview(
        target === null
          ? null
          : { entityId: press.entity.id, bounds: tableFillPreviewBounds(source, target) },
      );
    },
    // 🔴 Το μοντέλο γράφεται **μία φορά**, εδώ. Δες την κεφαλίδα.
    onEnd: () => {
      clearTableFillPreview();
      if (target === null) return;
      const live = press.entity;
      press.commit(live, applyTableFill(live.model, source, target));
      selectFilled(source, target, model);
    },
  });
  return true;
}

/**
 * Η **πηγή** της συμπλήρωσης: η επιλογή αν υπάρχει, αλλιώς το ενεργό κελί.
 *
 * 🔴 **ADR-754 §14 — η απόφαση δεν γράφεται πια εδώ.** Εδώ ζούσε η **δεύτερη** διατύπωσή της
 * (`if (cursor.selection) return resolveTableSelectionBounds(...)`), δίπλα στην πρώτη του
 * ζωγράφου (`selectionBounds ?? ενεργό κελί`) — και οι δύο **διαφωνούσαν** όταν η επιλογή ήταν
 * μπαγιάτικη: ο ζωγράφος ζωγράφιζε λαβή στο ενεργό κελί, αυτός εδώ αρνιόταν να την πιάσει.
 * Τώρα ρωτούν οι τρεις (ζωγράφος, πάτημα, **δείκτης**) την ίδια `tableFillSourceBounds`.
 *
 * ⚠️ Η ανάλυση της επιλογής μένει εδώ και δεν μετακόμισε μέσα της: εκείνη τη ζητά ο ζωγράφος
 * **ήδη λυμένη** για το περίγραμμα του ίδιου καρέ, και μια δεύτερη ανάλυση εκεί θα ήταν δεύτερη
 * απάντηση στο «τι μάρκαρε ο χρήστης» μέσα στο ίδιο καρέ.
 */
function fillSourceBounds(model: TableModel, cursor: TableCellCursorState): TableCellRangeBounds | null {
  const cell: TableCellRef = { rowId: cursor.position.rowId, colId: cursor.position.colId };
  const selected = cursor.selection ? resolveTableSelectionBounds(model, cursor.selection) : null;
  return tableFillSourceBounds(model, cell, selected);
}

/**
 * Έπεσε το πάτημα πάνω στη λαβή; Η γεωμετρία περνά από τον **έναν** δρόμο — τον ίδιο
 * `tableFillHandleHitAtFrame` που απαντά και στον **δείκτη** (§14). Ο χρήστης πιάνει ό,τι του
 * υπόσχεται ο λεπτός σταυρός, στο ίδιο ακριβώς pixel.
 */
function isOnHandle(press: TableFillHandlePress, source: TableCellRangeBounds): boolean {
  const geometry = computeTableEntityGeometryLive(press.entity);
  const pxPerMm = tablePxPerMm(tableMmToWorldLive(), press.transform.scale);
  const frame = tableWorldToFrame(press.entity, press.worldPoint.x, press.worldPoint.y, geometry.mmToWorld);
  return tableFillHandleHitAtFrame(geometry.layout, frame, pxPerMm, source) !== null;
}

/** Το κελί κάτω από το χέρι, μεταφρασμένο σε **δείκτες**, και από εκεί σε υπόσχεση. */
function fillTargetOf(model: TableModel, source: TableCellRangeBounds, to: TableCellRef) {
  const row = indexById(model.rows).get(to.rowId);
  const col = indexById(model.columns).get(to.colId);
  if (row === undefined || col === undefined) return null;
  return resolveTableFillTarget(source, { row, col });
}

/**
 * 🔴 Μετά τη συμπλήρωση, μαρκαρισμένη μένει **ολόκληρη** η περιοχή — πηγή και γέμισμα μαζί
 * (Excel parity). Χωρίς αυτό η λαβή θα έμενε στη γωνία της **παλιάς** επιλογής, δηλαδή ο
 * χρήστης θα έπρεπε να ξαναμαρκάρει για να συνεχίσει.
 */
function selectFilled(
  source: TableCellRangeBounds,
  target: NonNullable<ReturnType<typeof resolveTableFillTarget>>,
  model: TableModel,
): void {
  const bounds = tableFillPreviewBounds(source, target);
  const from = cellAt(model, bounds.firstRow, bounds.firstCol);
  const to = cellAt(model, bounds.lastRow, bounds.lastCol);
  if (from && to) setTableCellSelection({ from, to, kind: 'range' });
}

/** Δείκτες → ταυτότητες· `null` έξω από το πλέγμα (μπαγιάτικα όρια μετά από undo). */
function cellAt(model: TableModel, row: number, col: number): TableCellRef | null {
  const rowEntry = model.rows[row];
  const colEntry = model.columns[col];
  return rowEntry && colEntry ? { rowId: rowEntry.id, colId: colEntry.id } : null;
}
