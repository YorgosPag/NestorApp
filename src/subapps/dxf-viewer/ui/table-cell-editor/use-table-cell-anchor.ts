'use client';

/**
 * ADR-739 §31.10 — **από κελί μοντέλου σε κουτί οθόνης**, και τίποτα άλλο.
 *
 * Εξήχθη από το `useTableCellDoubleClickEditor` όταν εκείνο ξεπέρασε τις 500 γραμμές
 * (N.7.1). **Εξαγωγή, όχι κόψιμο**: οι τρεις τιμές εδώ (στόχος, πρόχειρο, άγκυρο) είναι μία
 * αλυσίδα παραγώγων που δεν διαβάζει τίποτα άλλο από τη συνεδρία — ούτε ιστορικό, ούτε
 * εντολές, ούτε ενέργειες περιοχής. Ο οδηγός κρατά τις **αποφάσεις**· εδώ ζει η **γεωμετρία
 * της οθόνης**.
 *
 * 🔴 Δέχεται τη **ζωντανή** οντότητα ως όρισμα και δεν τη διαβάζει μόνος του από τη σκηνή.
 * Μια δεύτερη ανάγνωση μέσα στο ίδιο render θα μπορούσε να δει άλλο (ή σβησμένο) πίνακα —
 * το ακριβώς σφάλμα που περιγράφει το σχόλιο του `liveEntity` στον οδηγό. Η ανάγνωση ζει
 * **μία** φορά, εκεί ψηλά.
 *
 * @see ui/table-cell-editor/table-cell-editor-frame-live.ts — ο υπολογισμός του κουτιού
 * @see ui/text-toolbar/text-editor-anchor-2d.ts — η αγκύρωση σε σημείο κόσμου
 */

import { useMemo, type RefObject } from 'react';
import {
  resolveTableCellEditTargetById,
  type TableCellEditTarget,
} from '../../bim/table/table-cell-edit-session';
import { createTextEditorAnchor2D } from '../text-toolbar/text-editor-anchor-2d';
import type {
  TextEditorAnchor,
  TextEditorAnchorBox,
} from '../text-toolbar/TextEditorAnchorLayer';
import { resolveDxfCanvasBackgroundHex } from '../../config/color-config';
import { cellEditorFrameLive } from './table-cell-editor-frame-live';
import { tableCellEditorCssVars } from './table-cell-editor-vars';
import type { TableCellCursorState } from '../../state/table-cell-cursor-store';
import type { TableEntity } from '../../types/table-entity';

/**
 * Το κελί του δρομέα μαζί με τη γωνία του **πίνακα**.
 *
 * Η γωνία ταξιδεύει δίπλα στο κελί επειδή ανήκει στην **οντότητα**, όχι στο κελί, και ο
 * επεξεργαστής πρέπει να γείρει μαζί με τον πίνακα.
 */
export interface TableCellAnchorTarget {
  readonly cell: TableCellEditTarget;
  readonly angleRad: number;
}

export interface UseTableCellAnchorParams {
  readonly cursor: TableCellCursorState | null;
  /** Η **ζωντανή** οντότητα του δρομέα· `null` όταν ο πίνακας χάθηκε από κάτω του. */
  readonly entity: TableEntity | null;
  readonly containerRef: RefObject<HTMLDivElement | null>;
}

export interface TableCellAnchorApi {
  readonly target: TableCellAnchorTarget | null;
  readonly anchor: TextEditorAnchor | null;
}

export function useTableCellAnchor(params: UseTableCellAnchorParams): TableCellAnchorApi {
  const { cursor, entity, containerRef } = params;

  // Το κελί του δρομέα, διαβασμένο από το ΖΩΝΤΑΝΟ μοντέλο: κείμενο, όψη και αγκύρωση είναι
  // **παράγωγα**, ποτέ αντίγραφα (γι' αυτό το store δεν κρατά κείμενο).
  const target = useMemo<TableCellAnchorTarget | null>(() => {
    if (!cursor || !entity) return null;
    const cell = resolveTableCellEditTargetById(entity, cursor.position.rowId, cursor.position.colId);
    return cell ? { cell, angleRad: entity.angleRad } : null;
  }, [cursor, entity]);

  // 🔴 ADR-739 Φ.Δ βήμα 6 — το `draft` μπαίνει στις εξαρτήσεις **επίτηδες**: το κουτί
  // μεγαλώνει με το κείμενο, άρα αλλάζει σε κάθε πάτημα πλήκτρου. Ο `cursor` ήδη άλλαζε ανά
  // πάτημα (το πρόχειρο ζει μέσα του), οπότε αυτό **δεν** προσθέτει καμία νέα απόδοση —
  // απλώς κάνει ρητό ότι το κουτί εξαρτάται από αυτό.
  //
  // Σε **πλοήγηση** δεν περνά πρόχειρο: εκεί ο επεξεργαστής είναι διαφανής και το κουτί
  // πρέπει να είναι ακριβώς το κελί (τον δρομέα τον ζωγραφίζει ο καμβάς πάνω σε αυτό).
  const draft = cursor && cursor.mode !== 'nav' ? cursor.draft : undefined;

  // Σταθερή ταυτότητα ανά κελί: το `TextEditorAnchorLayer` ξαναδένει τη συνδρομή του σε
  // κάθε νέο `anchor`, οπότε ένα φρέσκο αντικείμενο ανά απόδοση θα ξέδενε/ξανάδενε τον
  // scheduler σε κάθε πάτημα πλήκτρου.
  //
  // 🔴 ADR-739 Φ.Δ βήμα 3 — ΕΔΩ ζούσαν δύο σταθερές, `140 × 24 px`. Ήταν αυτές που έκαναν
  // τον επεξεργαστή «μαύρο κουτάκι πάνω-αριστερά μέσα στο κελί» (Giorgio, 2026-08-01):
  // ένα ξένο κουτί σε px οθόνης, που δεν κληρονομούσε ούτε μέγεθος, ούτε γραμματοσειρά,
  // ούτε στοίχιση, ούτε χρώμα, ούτε την περιστροφή του πίνακα. Τη θέση τους παίρνει ένα
  // **ζωντανό** κουτί, παράγωγο της ίδιας διάταξης που ζωγραφίζει ο καμβάς.
  const anchor = useMemo<TextEditorAnchor | null>(() => {
    if (!target) return null;
    const { cell, angleRad } = target;
    // Το φόντο διαβάζεται ΜΙΑ φορά ανά συνεδρία — δες το σχόλιο του `cellEditorFrameLive`.
    const backgroundHex = resolveDxfCanvasBackgroundHex();
    const projectBox = (point: { x: number; y: number } | null): TextEditorAnchorBox => {
      const frame = cellEditorFrameLive(
        cell,
        angleRad,
        backgroundHex,
        draft === undefined ? undefined : { draft, anchor: point },
      );
      return {
        widthPx: frame.widthPx,
        heightPx: frame.heightPx,
        rotationRad: frame.rotationRad,
        offsetXPx: frame.offsetXPx,
        cssVars: tableCellEditorCssVars(frame),
      };
    };
    const initial = projectBox(null);
    return {
      ...createTextEditorAnchor2D({
        worldPoint: cell.anchorWorldPoint,
        getContainer: () => containerRef.current,
        // Το στατικό μέγεθος μένει ως έσχατο δίχτυ του clamping· το ζωντανό κουτί το
        // αντικαθιστά σε κάθε tick.
        size: { width: initial.widthPx, height: initial.heightPx },
      }),
      projectBox,
    };
  }, [target, containerRef, draft]);

  return useMemo(() => ({ target, anchor }), [target, anchor]);
}
