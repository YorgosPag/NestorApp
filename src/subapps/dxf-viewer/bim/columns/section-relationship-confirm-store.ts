/**
 * ADR-363 §5.6c — «Σχέσεις διατομής εκτός εύρους» confirm-dialog handshake store.
 *
 * Module-level Promise handshake (mirror του `shear-wall-extent-confirm-store`): όταν η αλλαγή
 * διαστάσεων μιας κολόνας οποιουδήποτε τύπου (Γ/Τ/Π/Ι/πολύγωνο/σύνθετη/τοιχίο) εισάγει νέα παραβίαση
 * «σχέσης» (βλ. `section-relationship-warning.ts`), αναστέλλουμε το commit και προειδοποιούμε
 * (SOFT — ΠΟΤΕ block· big-player passive-warn):
 *   - 'proceed' → εφαρμογή διαστάσεων ως έχουν (ο χρήστης γνωρίζει).
 *   - 'cancel'  → τίποτα (ESC / επαναφορά).
 *
 * Pattern: mutable module-level state + () => void subscriber set + stable snapshot getter —
 * συμβατό με `useSyncExternalStore` (ADR-040 SSoT stores). Ένα μόνο dialog εκκρεμεί κάθε στιγμή.
 *
 * @see ../../ui/dialogs/SectionRelationshipDialog.tsx — ο consumer (self-subscribing portal dialog)
 * @see ./section-relationship-warning.ts — `detectColumnRelationshipWarning`
 * @see ./shear-wall-extent-confirm-store.ts — το precedent pattern
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6c
 */

import { createConfirmStore } from '../../stores/createConfirmStore';

/** Απόκριση χρήστη: συνέχεια (γνωρίζω) / ακύρωση. */
export type SectionRelationshipAction = 'proceed' | 'cancel';

export interface SectionRelationshipState {
  readonly open: boolean;
  /** i18n keys των νέων παραβιάσεων (ήδη μεταφρασμένα — render με t(key)). */
  readonly violationKeys: readonly string[];
}

// ─── Module-level state ───────────────────────────────────────────────────────

const CLOSED: SectionRelationshipState = { open: false, violationKeys: [] };

const store = createConfirmStore<SectionRelationshipState, SectionRelationshipAction>(CLOSED);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ανοίγει το confirm dialog «σχέσεις διατομής εκτός εύρους». Αναστέλλει το commit μέχρι την
 * απόκριση. Επιστρέφει Promise με την επιλογή του χρήστη.
 */
export function requestSectionRelationshipConfirm(args: {
  violationKeys: readonly string[];
}): Promise<SectionRelationshipAction> {
  return store.request({ open: true, violationKeys: [...args.violationKeys] });
}

/** Καλείται από το dialog στο κλικ του χρήστη. */
export function resolveSectionRelationship(action: SectionRelationshipAction): void {
  store.resolve(action);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeSectionRelationship(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Ίδια reference μεταξύ αλλαγών. */
export function getSectionRelationshipState(): SectionRelationshipState {
  return store.getSnapshot();
}
