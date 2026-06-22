/**
 * COLUMN PLACEMENT GHOST STATUS STORE — zero-React singleton (ADR-398 §3.10 commit-time handoff).
 *
 * **Ρόλος μετά το §3.10 (sync-in-preview):** το column face-snap υπολογίζεται πλέον ΣΥΓΧΡΟΝΑ στο
 * preview (`column-preview-helpers`) ΚΑΙ στο commit (`mouse-handler-up`) — ΟΧΙ async στον scheduler.
 * Αυτό το store έμεινε ως **commit-time handoff** ΜΟΝΟ: ο `mouse-handler-up` γράφει εδώ την auto
 * λαβή + το status του click-time face-snap, και ο `useColumnTool` (1ο κλικ) τα διαβάζει
 * imperatively για να επιλέξει anchor (center-anchor όταν `status==='beam'`). Καμία per-frame
 * εγγραφή πλέον (το ghost δεν διαβάζει από εδώ — έχει το δικό του face-snap result).
 *
 *   · `beam`    → 🟢 (η κολώνα κουμπώνει σε παρειά/άξονα μέλους).
 *   · `overlap` → 🔴 (κοντή άκρη δοκαριού).
 *   · `neutral` → ελεύθερη τοποθέτηση.
 *
 * @see ../../bim/columns/column-face-snap.ts — ο resolver (πηγή της λαβής/status)
 * @see ../../systems/cursor/mouse-handler-up.ts — ο writer (commit)
 * @see ../../hooks/drawing/useColumnTool.ts — ο reader (1ο κλικ → anchor)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.10
 */

import type { ColumnAnchor } from '../../bim/types/column-types';

/** Σημασιολογικό status του ghost κατά την τοποθέτηση κολώνας. */
export type ColumnGhostStatus = 'beam' | 'overlap' | 'neutral';

let status: ColumnGhostStatus = 'neutral';

/**
 * ADR-398 §Column smart-ghost face-snap — η λαβή (1 από 9) που επέλεξε ΑΥΤΟΜΑΤΑ το column
 * face-snap ώστε η κολώνα να ακουμπά flush στην παρειά στόχου. `null` = ελεύθερη τοποθέτηση (ο
 * χρήστης ορίζει τη λαβή με Tab). Γράφεται από τον `mouse-handler-up` (commit) — διαβάζεται
 * imperatively από το `useColumnTool` (1ο κλικ).
 */
let faceAnchor: ColumnAnchor | null = null;

/** Write — από τον `mouse-handler-up` στο commit (click-time face-snap result). */
export function setColumnGhostStatus(next: ColumnGhostStatus): void {
  status = next;
}

/** Read — imperatively στο `useColumnTool` 1ο κλικ (center-anchor όταν `beam`). */
export function getColumnGhostStatus(): ColumnGhostStatus {
  return status;
}

/** Write — auto-selected face-snap λαβή (`null` όταν δεν υπάρχει face-snap). */
export function setColumnFaceAnchor(next: ColumnAnchor | null): void {
  faceAnchor = next;
}

/** Read — imperatively στο `useColumnTool` 1ο κλικ (anchor precedence). */
export function getColumnFaceAnchor(): ColumnAnchor | null {
  return faceAnchor;
}

/** Clear — reset σε `neutral` + καμία face λαβή (έξοδος από snappable mode / cleanup). */
export function clearColumnGhostStatus(): void {
  status = 'neutral';
  faceAnchor = null;
}
