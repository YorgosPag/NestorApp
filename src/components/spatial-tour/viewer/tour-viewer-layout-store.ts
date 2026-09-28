/**
 * @fileoverview **ΠΟΣΟ ΠΛΑΤΙΑ ΕΙΝΑΙ Η ΣΤΗΛΗ ΚΑΤΟΨΕΩΝ** — ο ΕΝΑΣ κάτοχος του αποθηκευμένου πλάτους και της απόκρυψης
 * (ADR-884 Φ2στ-γ Γ2 · §4.14 σημείο 3).
 * @related `@/lib/storage` (`safeGetItem`/`safeSetItem` — SSR-safe, quota-safe) · `TourViewer.tsx` ·
 *   `components/ui/resizable-persistence.ts` (**πότε** γράφεται: μόνο στο τέλος μιας χειρονομίας)
 * @module components/spatial-tour/viewer/tour-viewer-layout-store
 *
 * 🔑 **Όχι `useDefaultLayout` της βιβλιοθήκης** (ADR-724 §5.3): θα γινόταν δεύτερος κάτοχος, και αποθηκεύει **ποσοστά** —
 *   25% δίνει άλλο πλάτος σε άλλη οθόνη. Εδώ ζουν **px**.
 * 🔑 **Η αποθηκευμένη τιμή είναι ιστορικό, όχι αλήθεια**: μπορεί να γράφτηκε από άλλη έκδοση ή να αλλοιώθηκε ⇒ ελέγχεται
 *   και κόβεται στα όρια σε **κάθε** ανάγνωση. Αλλοιωμένη ⇒ προεπιλογή, ποτέ σφάλμα.
 * 🔑 **Η απόκρυψη θυμάται και το πλάτος**: «εμφάνιση» επαναφέρει τη στήλη εκεί που ήταν (VS Code · Figma).
 */

import { clamp } from '@/lib/geometry/scalar';
import { STORAGE_KEYS, safeGetItem, safeSetItem } from '@/lib/storage';

/**
 * Όρια σε px — τα **ίδια** για το σύρσιμο (`minSize`/`maxSize` του panel) και για την ανάγνωση: ό,τι επιτρέπει το χέρι το
 * θυμάται και η αποθήκευση. Το πανόραμα προστατεύεται χωριστά (`STAGE_MIN_WIDTH`) σε στενές οθόνες.
 */
export const TOUR_PLAN_COLUMN = {
  widthMin: 280,
  widthDefault: 320,
  widthMax: 720,
} as const;

export interface TourPlanColumnLayout {
  readonly width: number;
  readonly collapsed: boolean;
}

const DEFAULT_LAYOUT: TourPlanColumnLayout = { width: TOUR_PLAN_COLUMN.widthDefault, collapsed: false };

function clampColumnWidth(width: number): number {
  return Math.round(clamp(width, TOUR_PLAN_COLUMN.widthMin, TOUR_PLAN_COLUMN.widthMax));
}

/** Ό,τι κι αν βρεθεί στην αποθήκευση ⇒ έγκυρη διάταξη, μέσα στα όρια. */
export function parseTourPlanColumn(raw: unknown): TourPlanColumnLayout {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_LAYOUT;
  const { width, collapsed } = raw as { readonly width?: unknown; readonly collapsed?: unknown };
  return {
    width: typeof width === 'number' && Number.isFinite(width) ? clampColumnWidth(width) : DEFAULT_LAYOUT.width,
    collapsed: collapsed === true,
  };
}

export function readTourPlanColumn(): TourPlanColumnLayout {
  return parseTourPlanColumn(safeGetItem<unknown>(STORAGE_KEYS.TOUR_PLAN_COLUMN, null));
}

/**
 * Καταγράφει ό,τι **μέτρησε** το DOM στο τέλος μιας χειρονομίας. `0` px ⇒ η στήλη συμπτύχθηκε (σύρσιμο κάτω από το
 * ελάχιστο ή κουμπί): κρατιέται το προηγούμενο πλάτος, ώστε η «εμφάνιση» να επιστρέψει εκεί.
 */
export function writeTourPlanColumn(measuredWidth: number): TourPlanColumnLayout {
  const previous = readTourPlanColumn();
  const next = measuredWidth < 1
    ? { width: previous.width, collapsed: true }
    : { width: clampColumnWidth(measuredWidth), collapsed: false };
  if (next.width !== previous.width || next.collapsed !== previous.collapsed) safeSetItem(STORAGE_KEYS.TOUR_PLAN_COLUMN, next);
  return next;
}
