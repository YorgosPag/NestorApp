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
 * Mirror του `ImmediateSnapStore`: το `column-preview-helpers` το διαβάζει **imperatively**
 * (zero React subscription) ώστε το WYSIWYG ghost (status color + auto λαβή) να ταυτίζεται
 * με το commit (`commitColumnFromState`) χωρίς re-render (ADR-040 cardinal rule).
 *
 * @see ./ImmediateSnapStore.ts — ίδιο pattern (snap point + entityId)
 * @see ../../bim/columns/column-placement-snap-context.ts — η πηγή του status
 * @see ../../hooks/drawing/column-preview-helpers.ts — ο WYSIWYG consumer (ADR-398 §3.8)
 */

import type { ColumnAnchor } from '../../bim/types/column-types';
import type { GhostFaceFrame } from '../../bim/framing/linear-member-face-snap';

/** Σημασιολογικό status του ghost κατά την τοποθέτηση κολώνας. */
export type ColumnGhostStatus = 'beam' | 'overlap' | 'neutral';

let status: ColumnGhostStatus = 'neutral';

/**
 * ADR-398 §Column smart-ghost face-snap — η λαβή (1 από 9) που επέλεξε ΑΥΤΟΜΑΤΑ το column
 * face-snap (`resolveColumnFaceSnap`) ώστε η κολώνα να ακουμπά flush στην παρειά στόχου. `null`
 * = ελεύθερη τοποθέτηση (ο χρήστης ορίζει τη λαβή με Tab). Γράφεται από τον `snap-scheduler`
 * (move) + `mouse-handler-up` (click) — διαβάζεται imperatively από το commit + ghost draw.
 */
let faceAnchor: ColumnAnchor | null = null;

/** Write — από τον snap-scheduler ανά move detection (column tool active). */
export function setColumnGhostStatus(next: ColumnGhostStatus): void {
  status = next;
}

/** Read — imperatively μέσα στο RAF draw του ghost preview. */
export function getColumnGhostStatus(): ColumnGhostStatus {
  return status;
}

/** Write — auto-selected face-snap λαβή (`null` όταν δεν υπάρχει face-snap). */
export function setColumnFaceAnchor(next: ColumnAnchor | null): void {
  faceAnchor = next;
}

/** Read — imperatively στο commit (anchor precedence) + στο ghost draw (single-anchor). */
export function getColumnFaceAnchor(): ColumnAnchor | null {
  return faceAnchor;
}

/**
 * ADR-508 §dim — πλαίσιο παρειάς του τρέχοντος column face-snap, για τις listening dimensions
 * του ghost (ΙΔΙΟ SSoT με τοίχο/δοκάρι). `null` = καμία face-snap → καμία διάσταση.
 */
let faceFrame: GhostFaceFrame | null = null;

/** Write — από τον snap-scheduler (move). `null` όταν δεν υπάρχει face-snap. */
export function setColumnFaceFrame(next: GhostFaceFrame | null): void {
  faceFrame = next;
}

/** Read — imperatively στο ghost draw (`column-preview-helpers`) για τις listening dimensions. */
export function getColumnFaceFrame(): GhostFaceFrame | null {
  return faceFrame;
}

/** Clear — reset σε `neutral` + καμία face λαβή/frame (έξοδος από snappable mode / cleanup). */
export function clearColumnGhostStatus(): void {
  status = 'neutral';
  faceAnchor = null;
  faceFrame = null;
}
