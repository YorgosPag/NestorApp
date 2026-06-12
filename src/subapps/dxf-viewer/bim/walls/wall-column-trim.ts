/**
 * ADR-441 Slice GEN-WALL — trim grid walls to column FACES (Revit-grade, face-to-face).
 *
 * **Back-compat shim.** Η λογική γενικεύτηκε (ADR-441 Slice GEN-BEAM) σε kind-agnostic
 * SSoT `bim/columns/column-face-trim.ts` ώστε ΚΑΙ οι τοίχοι ΚΑΙ τα δοκάρια να κάνουν
 * frame-into στις κολώνες μέσω ΜΙΑΣ μηχανής. Αυτό το module διατηρεί τα ιστορικά ονόματα
 * (`trimWallEndpointsToColumns`/`WallTrimResult`) ώστε ο `wall-from-grid` + τα tests του
 * να μένουν αμετάβλητα.
 *
 * @see bim/columns/column-face-trim.ts — kind-agnostic SSoT
 */

export {
  trimSegmentEndpointsToColumns as trimWallEndpointsToColumns,
} from '../columns/column-face-trim';
export type { SegmentColumnTrimResult as WallTrimResult } from '../columns/column-face-trim';
