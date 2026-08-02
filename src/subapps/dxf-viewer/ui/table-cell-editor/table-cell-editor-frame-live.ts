'use client';

/**
 * ADR-739 Φ.Δ βήμα 3 — **το κουτί του κελιού σε px οθόνης, τη στιγμή της κλήσης**: η ζωντανή
 * πλευρά του `table-cell-editor-frame.ts`.
 *
 * ## Γιατί υπάρχουν ΔΥΟ αρχεία για ένα κουτί
 * Ο υπολογισμός είναι **καθαρός** και ζει στο `table-cell-editor-frame.ts` — δοκιμάζεται με
 * αριθμούς, χωρίς DOM και χωρίς store. Ό,τι τον τροφοδοτεί όμως **δεν** είναι καθαρό: η
 * κλίμακα σχεδίασης, το zoom της προβολής και το μέγεθος του παραθύρου διαβάζονται **ζωντανά,
 * τη στιγμή του καρέ** (ADR-040: event-time read μέσω getter, ποτέ στιγμιότυπο). Γι' αυτό ο
 * επεξεργαστής ζουμάρει μαζί με τον καμβά αντί να καρφώνεται στο μέγεθος που είχε το κελί
 * όταν έγινε το διπλό κλικ.
 *
 * Η γραμμή ανάμεσά τους είναι ακριβώς αυτή: **εδώ οι ζωντανές αναγνώσεις, εκεί η αριθμητική.**
 *
 * ## Γιατί ΔΕΝ έμεινε μέσα στο `useTableCellDoubleClickEditor`
 * Εκεί γεννήθηκε, και εκεί ήταν σωστό όσο ήταν δύο συναρτήσεις. Το αρχείο όμως είναι ο ένας
 * τόπος που ξέρει **και** το μοντέλο **και** το DOM, δηλαδή μαζεύει δουλειά από κάθε βήμα —
 * και χτύπησε το όριο των 500 γραμμών (N.7.1) στο §26.15. Η εξαγωγή είναι **σημασιολογική**,
 * όχι αριθμητική: αυτές οι δύο συναρτήσεις δεν χρειάζονται τίποτα από το hook (ούτε cursor,
 * ούτε levelManager, ούτε container) — μόνο τον στόχο και τη γωνία.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-cell-editor-frame-live
 * @see ui/table-cell-editor/table-cell-editor-frame.ts — η καθαρή αριθμητική (sheet-mm → px)
 * @see ui/table-cell-editor/table-cell-editor-expansion.ts — ως πού επιτρέπεται να μεγαλώσει
 */

import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { tableMmToWorldLive, tablePxPerMm } from '../../bim/table/table-entity-geometry';
import {
  computeTableCellEditorFrame,
  cellTextStartPx,
  type TableCellEditorFrame,
} from './table-cell-editor-frame';
import { editorGrowthCeilingPx } from './table-cell-editor-expansion';
import {
  cellCaretIndexAtPx,
  cellFontBandPx,
  cellTextWidthPx,
} from './table-cell-text-metrics';
import type { TableCellEditTarget } from '../../bim/table/table-cell-edit-session';

/** Το πρόχειρο και το σημείο αγκύρωσης — μόνο σε **γραφή**, όπου το κουτί επεκτείνεται. */
export interface TableCellEditorExpansion {
  readonly draft: string;
  readonly anchor: { readonly x: number; readonly y: number } | null;
}

/**
 * Το κουτί του κελιού σε px οθόνης, με **ζωντανές** εισόδους.
 *
 * Το `backgroundHex` έρχεται απ' έξω και **δεν** διαβάζεται εδώ: είναι `getComputedStyle` στο
 * `documentElement`, δηλαδή αναγκαστικό style recalc — σε κάθε καρέ zoom θα ήταν μετρήσιμο
 * κόστος για μια τιμή που αλλάζει μόνο σε αλλαγή θέματος.
 */
export function cellEditorFrameLive(
  target: TableCellEditTarget,
  angleRad: number,
  backgroundHex: string,
  expansion?: TableCellEditorExpansion,
): TableCellEditorFrame {
  const pxPerMm = tablePxPerMm(tableMmToWorldLive(), getImmediateTransform().scale);
  return computeTableCellEditorFrame({
    target,
    pxPerMm,
    angleRad,
    resolveBand: cellFontBandPx,
    backgroundHex,
    draft: expansion?.draft,
    resolveWidth: expansion ? cellTextWidthPx : undefined,
    maxWidthPx: expansion
      ? editorGrowthCeilingPx({
          anchor: expansion.anchor,
          rotationRad: -angleRad,
          cellWidthPx: target.rectMm.w * pxPerMm,
          growsFrom: target.hAlign === 'right' || target.hAlign === 'center' ? target.hAlign : 'left',
          viewport: { width: window.innerWidth, height: window.innerHeight },
        })
      : undefined,
  });
}

/**
 * Σε ποιον χαρακτήρα πέφτει το διπλό κλικ (Excel: ο κέρσορας μπαίνει **εκεί που έδειξες**).
 *
 * `undefined` όταν δεν υπάρχει σημείο κλικ — τότε ο επεξεργαστής βάζει τον κέρσορα στο
 * τέλος, που είναι η σωστή συμπεριφορά για `Tab` / `F2`.
 */
export function caretIndexOfClick(
  target: TableCellEditTarget,
  frame: TableCellEditorFrame,
): number | undefined {
  if (target.clickOffsetMm === undefined || !target.text) return undefined;
  const pxPerMm = frame.widthPx / target.rectMm.w;
  const startPx = cellTextStartPx(frame, cellTextWidthPx(target.text, frame.font));
  return cellCaretIndexAtPx(target.text, frame.font, target.clickOffsetMm * pxPerMm - startPx);
}
