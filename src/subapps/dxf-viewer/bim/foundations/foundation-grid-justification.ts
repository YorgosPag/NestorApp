/**
 * ADR-441 Slice 5a-grid — Κανόνας αυτόματης έδρασης άξονα (justification) εσχάρας.
 *
 * **MOVED (ADR-441 3-mode generalization, Slice 0):** η υλοποίηση μεταφέρθηκε στο neutral
 * `../grid/grid-justification.ts` ώστε να τη μοιράζονται ΚΑΙ κολόνες/δοκάρια/τοίχοι (όχι μόνο
 * foundations). Αυτό το αρχείο παραμένει ως **re-export** για back-compat των υπαρχόντων
 * foundation importers — μηδέν αλλαγή συμπεριφοράς.
 *
 * @see ../grid/grid-justification.ts — η κανονική πηγή (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

export {
  type GridStripOrientation,
  type GridPerimeterMode,
  DEFAULT_GRID_PERIMETER_MODE,
  gridStripJustification,
} from '../grid/grid-justification';
