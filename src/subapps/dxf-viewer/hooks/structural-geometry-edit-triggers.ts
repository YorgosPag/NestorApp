/**
 * structural-geometry-edit-triggers — SSoT ταξινόμηση «άμεση geometry edit χρήστη».
 *
 * Οι proactive structural hooks (`useProactiveStructuralLoads`,
 * `useProactiveMemberSizing`, `useProactiveOrganismReinforce`, `useAutoFoundationDesign`)
 * ομαδοποιούν την παράγωγη (associative) αντίδρασή τους στο **ΙΔΙΟ atomic undo step**
 * με το user command (Revit transaction group — `CommandHistory.appendToLast`,
 * ADR-459 Φ7) **μόνο** όταν το trigger είναι **άμεση geometry edit** του χρήστη, δηλαδή
 * έχει δικό του entry στο undo stack: `Create*` / `Update*Params` / `Move` / `Delete`.
 * Τα batch (`*-from-grid` / `*-from-perimeter`) και τα παράγωγα chain events
 * (`bim:structural-loads-computed` κ.λπ.) → **standalone** entry.
 *
 * **Γιατί SSoT (η ρίζα του «2× Ctrl+Z σε διαγραφή»):** πριν την εξαγωγή, κάθε hook
 * κρατούσε δικό του `GEOMETRY_EDIT_TRIGGERS` set — τέσσερα **αποκλίνοντα** αντίγραφα.
 * Τα `*-delete-requested` προστέθηκαν στις λίστες συνδρομής (`PROACTIVE_*_EVENTS`) αλλά
 * **ξεχάστηκαν** στα geom-edit sets των loads + foundation → η διαγραφή δρομολογούσε το
 * recalc ως standalone (`execute`) αντί grouped (`executeGrouped`) → δεύτερο entry στο
 * stack → χρειαζόταν 2η αναίρεση. ΕΝΑ classifier εγγυάται συνεπή ταξινόμηση παντού και
 * αποτρέπει την επανάληψη του λάθους.
 *
 * **Η διαγραφή ΕΙΝΑΙ geometry edit:** η `DeleteEntityCommand` (+ ADR-401 detach των
 * εξαρτημένων ως children) είναι **ΕΝΑ** entry στο stack· η παράγωγη ανακατανομή
 * φορτίων / διαστασιολόγηση / επανασχεδιασμός θεμελίωσης πρέπει να επανέρχεται **μαζί
 * της** με 1× Ctrl+Z, ακριβώς όπως η Revit αναιρεί τη διαγραφή + τις συνέπειές της
 * ατομικά.
 *
 * **Superset-safe:** ο predicate ερωτάται ΜΟΝΟ για events στα οποία ο εκάστοτε hook έχει
 * ήδη κάνει subscribe· άρα ένα event που δεν ανήκει στο subscription list ενός hook είναι
 * αβλαβές για αυτόν. Έτσι ένα ενιαίο (ευρύτερο) σύνολο διατηρεί τη συμπεριφορά όλων των
 * hooks και προσθέτει **μόνο** την επιθυμητή ομαδοποίηση της διαγραφής εκεί που λείπε.
 *
 * @see core/commands/CommandHistory.ts — appendToLast (το grouping SSoT)
 * @see core/commands/CompositeCommand.ts — το transaction group
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import type { DrawingEventType } from '../systems/events/EventBus';

/**
 * Τα events που αντιστοιχούν σε **άμεση geometry edit** του χρήστη — καθένα παράγει το
 * δικό του command στο undo stack, οπότε η παράγωγη structural αντίδραση ομαδοποιείται
 * πάνω του (`appendToLast`). Κάθε άλλο trigger (batch / derived chain) → standalone.
 */
export const GEOMETRY_EDIT_TRIGGERS: ReadonlySet<DrawingEventType> = new Set<DrawingEventType>([
  // ADR-459 v19 — το SINGLE-PATH σημασιολογικό event· πάντα πηγάζει από move/create (άμεσες
  // geometry edits) → η structural αντίδραση ομαδοποιείται στο ΙΔΙΟ atomic undo step.
  'bim:structural-geometry-changed',
  // Δημιουργία — Create*Command (νέα κολόνα/δοκάρι/πλάκα/πέδιλο/τοίχος).
  'drawing:entity-created',
  // Επεξεργασία παραμέτρων/διατομής — Update*ParamsCommand (grip-resize / ribbon edit).
  'bim:column-params-updated',
  'bim:beam-params-updated',
  'bim:wall-params-updated',
  'bim:slab-params-updated',
  'bim:foundation-params-updated',
  // Μετακίνηση — MoveEntityCommand (drag-move).
  'bim:entities-moved',
  // Διαγραφή — DeleteEntityCommand (+ ADR-401 detach children). Η παράλειψη που
  // διορθώνεται: χωρίς αυτά, η διαγραφή έβγαζε το recalc ως standalone → 2× Ctrl+Z.
  'bim:column-delete-requested',
  'bim:beam-delete-requested',
  'bim:wall-delete-requested',
  'bim:slab-delete-requested',
  'bim:foundation-delete-requested',
]);

/**
 * `true` αν το event είναι άμεση geometry edit του χρήστη (έχει δικό του undo entry) →
 * η παράγωγη structural αντίδραση ομαδοποιείται στο ίδιο atomic undo step.
 */
export function isGeometryEditTrigger(ev: DrawingEventType): boolean {
  return GEOMETRY_EDIT_TRIGGERS.has(ev);
}
