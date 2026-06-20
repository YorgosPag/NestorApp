/**
 * Ghost status color SSoT (ADR-398 §ghost coloring) — neutral home.
 *
 * Εξήχθη από το `ColumnAnchorGhostRenderer` ώστε ΚΑΙ το column anchor ghost ΚΑΙ το
 * beam ghost να αντλούν το ίδιο 🟢/🔴 παλέτα **χωρίς beam→column-renderer coupling**.
 * Re-exported από `ColumnAnchorGhostRenderer` (back-compat για `useColumnGhostPreview`).
 *
 * @see ../columns/ColumnAnchorGhostRenderer.ts — re-export + column consumer
 * @see ../beams/beam-beam-face-snap.ts — beam consumer (κατευθυντικό status)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

/** Σημασιολογικό status ghost: 🟢 έγκυρος στόχος / 🔴 σύγκρουση / ουδέτερο. */
export type GhostStatus = 'beam' | 'overlap' | 'neutral';

/** Χρωματισμός ghost ανά placement status (stroke + fill@alpha). */
export interface GhostStatusColor {
  readonly stroke: string;
  readonly fill: string;
}

/** Παλέτα: 🟢 `beam` (έγκυρη σύνδεση/άξονας) / 🔴 `overlap` (επικάλυψη/σύγκρουση). */
const GHOST_STATUS_COLORS: Readonly<Record<'beam' | 'overlap', GhostStatusColor>> = {
  beam: { stroke: '#2e9e44', fill: 'rgba(46, 158, 68, 0.30)' },
  overlap: { stroke: '#d23b3b', fill: 'rgba(210, 59, 59, 0.30)' },
};

/** Resolve status → χρώμα· `null` για `neutral` (κρατά το default χρώμα τύπου). */
export function resolveGhostStatusColor(status: GhostStatus): GhostStatusColor | null {
  return status === 'neutral' ? null : GHOST_STATUS_COLORS[status];
}
