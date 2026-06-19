/**
 * COLUMN PLACEMENT GHOST STATUS STORE — zero-React singleton (ADR-398 §ghost coloring).
 *
 * Κατά την τοποθέτηση κολώνας, ο decoupled snap-scheduler γράφει εδώ το σημασιολογικό
 * status του σημείου κάτω από το σταυρόνημα (`resolveColumnGhostStatusFromSnap` — thin
 * reader του ενιαίου snap result, ADR-398 bugfix 2026-06-19):
 *   · `beam`    → 🟢 πράσινο ghost (snap στον άξονα δοκαριού — το σημείο ρέει μέσω
 *                 `ImmediateSnapStore`).
 *   · `overlap` → 🔴 κόκκινο ghost (πάνω σε υπάρχουσα κολώνα — σύγκρουση).
 *   · `neutral` → default ghost (ελεύθερη τοποθέτηση).
 *
 * Mirror του `ImmediateSnapStore`: το `useColumnGhostPreview` το διαβάζει **imperatively**
 * μέσα στο RAF draw (zero React subscription) → ο χρωματισμός δεν προκαλεί re-render πάνω
 * από το leaf (ADR-040 cardinal rule).
 *
 * @see ./ImmediateSnapStore.ts — ίδιο pattern (snap point + entityId)
 * @see ../../bim/columns/column-placement-snap-context.ts — η πηγή του status
 * @see ../../hooks/tools/useColumnGhostPreview.ts — ο consumer (ghost color)
 */

/** Σημασιολογικό status του ghost κατά την τοποθέτηση κολώνας. */
export type ColumnGhostStatus = 'beam' | 'overlap' | 'neutral';

let status: ColumnGhostStatus = 'neutral';

/** Write — από τον snap-scheduler ανά move detection (column tool active). */
export function setColumnGhostStatus(next: ColumnGhostStatus): void {
  status = next;
}

/** Read — imperatively μέσα στο RAF draw του ghost preview. */
export function getColumnGhostStatus(): ColumnGhostStatus {
  return status;
}

/** Clear — reset σε `neutral` (έξοδος από snappable mode / cleanup). */
export function clearColumnGhostStatus(): void {
  status = 'neutral';
}
