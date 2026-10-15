/**
 * @fileoverview **ΠΟΣΟ ΠΛΑΤΙΑ ΕΙΝΑΙ Η ΣΤΗΛΗ ΚΑΤΟΨΕΩΝ** — ο ΕΝΑΣ κάτοχος του αποθηκευμένου πλάτους και της απόκρυψης
 * (ADR-884 Φ2στ-γ Γ2 · §4.14 σημείο 3).
 * @related `@/components/ui/resizable-column-store` (η μηχανή — κοινή με τον επιθεωρητή ακινήτων, ADR-840 Σ3) ·
 *   `TourViewer.tsx` · `components/ui/resizable-persistence.ts` (**πότε** γράφεται: μόνο στο τέλος μιας χειρονομίας)
 * @module components/spatial-tour/viewer/tour-viewer-layout-store
 *
 * Εδώ ζουν μόνο τα **όρια** και το **κλειδί**· η ανάγνωση/κοπή/εγγραφή είναι του `createColumnLayoutStore`.
 */

import { createColumnLayoutStore, type ColumnLayout } from '@/components/ui/resizable-column-store';
import { STORAGE_KEYS } from '@/lib/storage';

/**
 * Όρια σε px — τα **ίδια** για το σύρσιμο (`minSize`/`maxSize` του panel) και για την ανάγνωση. Το πανόραμα
 * προστατεύεται χωριστά (`STAGE_MIN_WIDTH`) σε στενές οθόνες.
 */
export const TOUR_PLAN_COLUMN = {
  widthMin: 280,
  widthDefault: 320,
  widthMax: 720,
} as const;

export type TourPlanColumnLayout = ColumnLayout;

export const tourPlanColumnStore = createColumnLayoutStore(STORAGE_KEYS.TOUR_PLAN_COLUMN, TOUR_PLAN_COLUMN);

export const parseTourPlanColumn = tourPlanColumnStore.parse;
export const readTourPlanColumn = tourPlanColumnStore.read;
export const writeTourPlanColumn = tourPlanColumnStore.write;
