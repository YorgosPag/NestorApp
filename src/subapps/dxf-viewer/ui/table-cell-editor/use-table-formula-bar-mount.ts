'use client';

/**
 * ADR-739 Φ.Δ βήμα 7 — **η αγκύρωση της γραμμής τύπων στον πίνακα**.
 *
 * Ξεχωριστό αρχείο από τον `useTableCellDoubleClickEditor` για δύο λόγους, και ο δεύτερος
 * είναι ο ουσιώδης:
 *  1. εκείνος είναι ήδη στα όρια του προϋπολογισμού των 500 γραμμών (N.7.1)·
 *  2. η γραμμή τύπων αγκυρώνεται στον **πίνακα**, ενώ ο επεξεργαστής κελιού στο **κελί**.
 *     Είναι δύο διαφορετικά άγκυρα με διαφορετικό κύκλο ζωής: το πρώτο αλλάζει μόνο όταν
 *     μετακινηθεί ο πίνακας, το δεύτερο σε **κάθε πάτημα πλήκτρου** (το κουτί μεγαλώνει με
 *     το κείμενο, βήμα 6). Ενωμένα σε ένα memo, το φθηνό θα πλήρωνε τον ρυθμό του ακριβού.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-formula-bar-mount
 * @see ui/table-cell-editor/TableFormulaBar.tsx — η όψη
 * @see ui/table-cell-editor/table-formula-bar-frame.ts — οι αριθμοί (καθαροί)
 */

import { useMemo, type RefObject } from 'react';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import { tableCellReference } from '../../bim/table/table-cell-reference';
import {
  computeTableEntityGeometryLive,
  tableFrameToWorld,
  tableMmToWorldLive,
  tablePxPerMm,
} from '../../bim/table/table-entity-geometry';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { createTextEditorAnchor2D } from '../text-toolbar/text-editor-anchor-2d';
import { computeTableFormulaBarFrame } from './table-formula-bar-frame';
import type { TableFormulaBarProps } from './TableFormulaBar';
import type { TableCellCursorState } from '../../state/table-cell-cursor-store';
import type { TableEntity } from '../../types/table-entity';
import type { TableCellSessionHandlers } from './table-cell-session-types';

/** Ό,τι χρειάζεται ο καλών για να στήσει την όψη — ίδιο σχήμα με τον επεξεργαστή κελιού. */
export interface TableFormulaBarMount {
  readonly key: string;
  readonly props: TableFormulaBarProps;
}

export interface UseTableFormulaBarMountParams extends TableCellSessionHandlers {
  /** Η **ζωντανή** οντότητα· `null` όταν ο πίνακας χάθηκε κάτω από τον δρομέα. */
  readonly entity: TableEntity | null;
  readonly cursor: TableCellCursorState | null;
  /** Το δεσμευμένο κείμενο του τρέχοντος κελιού, διαβασμένο από τον καλούντα. */
  readonly initialText: string;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  /**
   * 🔴 ADR-739 §69 — «πήγαινε σε αυτή τη διεύθυνση», από το πλαίσιο ονόματος.
   *
   * Παράγεται στον καλούντα (`useTableCellDoubleClickEditor`) και όχι εδώ, επειδή η **σειρά**
   * που τηρεί περιλαμβάνει τη δέσμευση προχείρου — δηλαδή τον ένα δεσμευτή, που ζει εκεί.
   * Δες `use-table-name-box-goto` για το γιατί η σειρά είναι συμβόλαιο.
   */
  readonly onGoTo: (text: string) => boolean;
}

export function useTableFormulaBarMount(
  params: UseTableFormulaBarMountParams,
): TableFormulaBarMount | null {
  const {
    entity, cursor, initialText, containerRef, onGoTo,
    onCommit, onMove, onClear, onHistory, onExtend, onSelectAll, onToggleAbsoluteRef,
  } = params;

  /**
   * Το άγκυρο: η **πάνω-αριστερή γωνία του πίνακα**, όχι του κελιού.
   *
   * Εξαρτάται μόνο από την οντότητα — δηλαδή αλλάζει όταν ο πίνακας μετακινηθεί ή αλλάξει
   * διάταξη, **όχι** ανά πάτημα πλήκτρου. Το ζωντανό κουτί (`projectBox`) ξαναβγαίνει σε
   * κάθε tick του scheduler, άρα το πλάτος ακολουθεί το zoom χωρίς κανένα re-render
   * (ADR-040) — ακριβώς όπως ο επεξεργαστής κελιού.
   */
  const anchor = useMemo(() => {
    if (!entity) return null;
    const geometry = computeTableEntityGeometryLive(entity);
    const { widthMm, heightMm } = geometry.layout;
    const worldPoint = tableFrameToWorld(entity, 0, 0, geometry.mmToWorld);
    /**
     * Πόσος χώρος υπάρχει πάνω από τον πίνακα **μέσα στην περιοχή σχεδίασης**.
     *
     * Η ανάγνωση γίνεται στη **φάση ανάγνωσης** του tick (το `TextEditorAnchorLayer` καλεί
     * `project()` και μετά `projectBox()`, και μόνο μετά γράφει) — καμία επιπλέον
     * ανακατασκευή διάταξης, όση 60 φορές το δευτερόλεπτο θα κόστιζε αν έμπαινε μετά.
     */
    const spaceAbove = (anchorPoint: { x: number; y: number } | null): number | null => {
      const container = containerRef.current;
      if (!container || !anchorPoint) return null;
      return anchorPoint.y - container.getBoundingClientRect().top;
    };
    const projectFrame = (
      anchorPoint: { x: number; y: number } | null,
    ): ReturnType<typeof computeTableFormulaBarFrame> =>
      computeTableFormulaBarFrame({
        tableWidthMm: widthMm,
        tableHeightMm: heightMm,
        // Ζωντανή ανάγνωση κλίμακας τη στιγμή του tick (ADR-040: getter, ποτέ στιγμιότυπο)
        // — ο ΙΔΙΟΣ δρόμος με το `cellEditorFrameLive` του επεξεργαστή κελιού.
        pxPerMm: tablePxPerMm(tableMmToWorldLive(), getImmediateTransform().scale),
        spaceAbovePx: spaceAbove(anchorPoint),
      });
    const initial = projectFrame(null);
    return {
      ...createTextEditorAnchor2D({
        worldPoint,
        getContainer: () => containerRef.current,
        size: { width: initial.widthPx, height: initial.heightPx },
      }),
      projectBox: (anchorPoint: { x: number; y: number } | null) => {
        const frame = projectFrame(anchorPoint);
        return {
          widthPx: frame.widthPx,
          heightPx: frame.heightPx,
          // 🔴 Η γραμμή τύπων ΔΕΝ γέρνει με τον πίνακα — δες την κεφαλίδα του
          // `TableFormulaBar`: είναι εργαλείο, όχι σχέδιο.
          rotationRad: 0,
          offsetXPx: frame.offsetXPx,
          offsetYPx: frame.offsetYPx,
        };
      },
    };
  }, [entity, containerRef]);

  return useMemo(() => {
    if (!entity || !cursor || !anchor) return null;
    const { rowId, colId } = cursor.position;
    // 🔴 §69 — **ΕΝΑ** μοντέλο για τους δύο καταναλωτές αυτής της γραμμής (η ονομασία
    // εδώ, η μέτρηση/μετάφραση στο πλαίσιο ονόματος). Ο ίδιος απομνημονευμένος (WeakMap)
    // δρόμος με τη γεωμετρία· μια δεύτερη κλήση μέσα στο φύλλο θα ήταν δεύτερη
    // αποσειριοποίηση ανά πάτημα πλήκτρου, για ταυτόσημο αποτέλεσμα.
    const model = resolveTableModel(entity.model);
    return {
      // Σταθερό ανά **πίνακα**, όχι ανά κελί: η γραμμή είναι μόνιμο κέλυφος της συνεδρίας.
      // Ένα κλειδί ανά κελί θα την ξαναέστηνε σε κάθε `Tab` — δηλαδή θα της έκλεβε την
      // εστίαση ακριβώς όταν ο χρήστης γράφει **μέσα** της.
      key: `table-formula-bar:${entity.id}`,
      props: {
        // Το μοντέλο περνά από τον ΙΔΙΟ απομνημονευμένο (WeakMap) δρόμο με τη γεωμετρία —
        // ίδιο persisted ⇒ ίδιο μοντέλο, καμία δεύτερη αποσειριοποίηση ανά πάτημα πλήκτρου.
        reference: tableCellReference(model, rowId, colId),
        model,
        onGoTo,
        mode: cursor.mode,
        draft: cursor.draft,
        initialText,
        // 🔴 ADR-754 §4 — η υπόδειξη κελιού γράφει κέρσορα **και για αυτό** το πεδίο: το
        // κλειδί εδώ είναι ανά **πίνακα**, άρα η γραμμή δεν ξαναστήνεται ποτέ μέσα στη
        // συνεδρία — χωρίς την αφορμή, ο κέρσοράς της θα έμενε για πάντα εκεί που τον
        // άφησε ο browser μετά την πρώτη αλλαγή τιμής.
        caretIndex: cursor.caretIndex,
        caretRevision: cursor.caretRevision,
        anchor,
        onCommit,
        onMove,
        onClear,
        onHistory,
        onExtend,
        onSelectAll,
        onToggleAbsoluteRef,
      },
    };
  }, [
    entity, cursor, anchor, initialText, onGoTo,
    onCommit, onMove, onClear, onHistory, onExtend, onSelectAll, onToggleAbsoluteRef,
  ]);
}
