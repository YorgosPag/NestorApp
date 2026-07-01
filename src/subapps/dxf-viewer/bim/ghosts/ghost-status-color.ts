/**
 * Ghost status color SSoT (ADR-398 §ghost coloring) — neutral home.
 *
 * Neutral SSoT ώστε ΟΛΑ τα WYSIWYG ghosts (κολώνα / δοκάρι / τοίχος) να αντλούν το
 * ίδιο 🟢/🔴 παλέτα **χωρίς coupling σε συγκεκριμένο renderer**. Καταναλώνεται από τα
 * `*-preview-helpers.ts` (μόνο 🔴 overlap → status schematic· 🟢/neutral → πλήρες WYSIWYG).
 *
 * @see ../../hooks/drawing/column-preview-helpers.ts — column WYSIWYG consumer (ADR-398 §3.8)
 * @see ../../hooks/drawing/beam-preview-helpers.ts — beam consumer
 * @see ../beams/beam-beam-face-snap.ts — beam consumer (κατευθυντικό status)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

/**
 * Σημασιολογικό status ghost: 🟢 έγκυρος στόχος / 🔴 σύγκρουση / 🟠 προειδοποίηση / ουδέτερο.
 * `warning` (🟠 πορτοκαλί) = επιτρεπτό αλλά «πρόσεξε» — ΟΧΙ απαγορευτικό (το 🔴 σημαίνει block).
 * π.χ. ADR-363 §5.6: όσο το grip-drag κρατά την ορθογώνια κολόνα σε σχέσεις τοιχίου (aspect > 4).
 */
export type GhostStatus = 'beam' | 'overlap' | 'warning' | 'neutral';

/** Χρωματισμός ghost ανά placement status (stroke + fill@alpha). */
export interface GhostStatusColor {
  readonly stroke: string;
  readonly fill: string;
}

/**
 * Παλέτα: 🟢 `beam` (έγκυρη σύνδεση/άξονας) / 🔴 `overlap` (επικάλυψη/σύγκρουση) /
 * 🟠 `warning` (πορτοκαλί — επιτρεπτό-με-προσοχή, ΟΧΙ απαγορευτικό).
 */
const GHOST_STATUS_COLORS: Readonly<Record<'beam' | 'overlap' | 'warning', GhostStatusColor>> = {
  beam: { stroke: '#2e9e44', fill: 'rgba(46, 158, 68, 0.30)' },
  overlap: { stroke: '#d23b3b', fill: 'rgba(210, 59, 59, 0.30)' },
  warning: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.30)' },
};

/** Resolve status → χρώμα· `null` για `neutral` (κρατά το default χρώμα τύπου). */
export function resolveGhostStatusColor(status: GhostStatus): GhostStatusColor | null {
  return status === 'neutral' ? null : GHOST_STATUS_COLORS[status];
}
