/**
 * statusFilterCard — Η ΜΙΑ κάρτα-φίλτρο εναλλαγής πάνω από τη **δική της** λίστα (ADR-330 §5.1 S3.3 · S3.4).
 *
 * Πατημένη ⇔ το φίλτρο είναι ακριβώς αυτή η τιμή· κλικ ξανά ⇒ αφαίρεση. Μηδέν ⇒ καμία πράξη (φίλτρο σε
 * άδεια λίστα = αδιέξοδο) — εκτός αν είναι ήδη πατημένη, ώστε να μπορεί πάντα να ξεπατηθεί.
 *
 * Ζούσε ιδιωτικά στο `rfq-dashboard-stats`· οι λίστες του hub (προσφορές · παραγγελίες · προμηθευτές ·
 * συμβάσεις) χρειάζονται την ίδια συμπεριφορά, άρα ένα σημείο. Καθαρό module (χωρίς hooks), για να το
 * εισάγουν και καθαροί υπολογισμοί που τρέχουν σε jest.
 *
 * @module components/projects/procurement/clients/status-filter-card
 */

import type { StatusDrill } from './useStatusDrillParam';

/**
 * Το κομμάτι της κάρτας του `UnifiedDashboard` που ορίζει η κάρτα-φίλτρο (`pressed` + `onActivate`), δομικά ίδιο
 * με το `DashboardStat`. ⚠️ ΔΕΝ εισάγεται από το `UnifiedDashboard`: ακόμη και το `import type` το ακολουθεί το
 * CHECK 3.34 (ADR-744) ⇒ `StatsCard` ⇒ μεταφράσεις τιμών ακινήτων (`common`, `search-results`) σε σελίδες RFQ
 * που δεν τις χρειάζονται (μετρημένο 2026-11-04).
 */
export interface FilterCardAction {
  pressed?: boolean;
  onActivate?: () => void;
}

/** Οι εγγραφές που περνούν το φίλτρο `?status=` — κενό φίλτρο ⇒ όλες (ίδιος πίνακας, ίδια ταυτότητα). */
export function applyStatusDrill<T, S extends string>(
  items: T[], statuses: readonly S[], statusOf: (item: T) => S,
): T[] {
  return statuses.length === 0 ? items : items.filter((item) => statuses.includes(statusOf(item)));
}

export function statusFilterCard<S extends string>(
  drill: Pick<StatusDrill<S>, 'statuses' | 'set'>, value: S, count: number,
): FilterCardAction {
  const pressed = drill.statuses.length === 1 && drill.statuses[0] === value;
  if (count === 0 && !pressed) return {};
  return { pressed, onActivate: () => drill.set(pressed ? [] : [value]) };
}
