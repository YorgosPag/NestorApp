/**
 * ADR-650 §M10g — ΤΟ ΣΗΜΑΔΙ: ποια ψημένα προϊόντα ο reconciler **αρνήθηκε** να μετακινήσει.
 *
 * Το fail-closed χωρίς ορατότητα είναι απλώς σιωπή με άλλο όνομα. Ο reconciler δεν μαντεύει
 * πλαίσιο για ένα legacy ψημένο προϊόν — αλλά ο χρήστης πρέπει να **μάθει** ότι ο κάναβός του
 * κάθεται σε ξεπερασμένο σύστημα και ότι η θεραπεία είναι ένα ξανα-ψήσιμο. (Εδώ πάμε πιο πέρα
 * από τον Revit: εκείνος δείχνει το link σε λάθος θέση μέχρι να κάνει ο χρήστης acquire, χωρίς
 * να ξέρει καν ότι υπάρχει πρόβλημα.)
 *
 * Runtime-only store (ADR-040 pattern): **δεν** σειριοποιείται — είναι το αποτέλεσμα του
 * τελευταίου περάσματος, όχι δεδομένο του έργου. Ξαναϋπολογίζεται σε κάθε reconcile.
 *
 * @see ./persistence/topo-frame-reconcile.ts — ο μοναδικός συγγραφέας
 * @see ../../ui/panels/topography/TopoFrameNotice.tsx — ο μοναδικός αναγνώστης (UI)
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { TopoBakedGroup } from './topo-baked-groups';

export interface TopoFrameStatus {
  /** Ψημένα προϊόντα **χωρίς σφραγίδα** (legacy): άγνωστο πλαίσιο ⇒ θέλουν ξανα-ψήσιμο. */
  readonly unstampedGroups: readonly TopoBakedGroup[];
  /** Ομάδες που περιέχουν τύπο εκτός του SSoT της στροφής ⇒ δεν μετακινήθηκαν καθόλου. */
  readonly unsupportedGroups: readonly TopoBakedGroup[];
}

const EMPTY_STATUS: TopoFrameStatus = { unstampedGroups: [], unsupportedGroups: [] };

const store = createExternalStore<TopoFrameStatus>(EMPTY_STATUS, {
  // Ίδιο περιεχόμενο ⇒ καμία ειδοποίηση: ο reconciler τρέχει σε κάθε αλλαγή επιπέδου και
  // θα ξανα-έγραφε το ίδιο άδειο αποτέλεσμα, ξυπνώντας το panel χωρίς λόγο.
  equals: (a, b) =>
    sameGroups(a.unstampedGroups, b.unstampedGroups) &&
    sameGroups(a.unsupportedGroups, b.unsupportedGroups),
});

/** Το τελευταίο αποτέλεσμα του reconciler. */
export function getTopoFrameStatus(): TopoFrameStatus {
  return store.get();
}

/**
 * Κατάθεσε το αποτέλεσμα του περάσματος για ένα επίπεδο.
 *
 * Το `levelId` καταγράφεται ώστε το μήνυμα να μη ζήσει περισσότερο από την οθόνη που το
 * γέννησε: ο χρήστης που αλλάζει επίπεδο βλέπει την κατάσταση **του επιπέδου που κοιτά**.
 */
export function setTopoFrameStatus(levelId: string, status: TopoFrameStatus): void {
  currentLevelId = levelId;
  store.set(status);
}

/** Το επίπεδο στο οποίο αναφέρεται η τρέχουσα κατάσταση (`null` πριν το πρώτο πέρασμα). */
export function getTopoFrameStatusLevelId(): string | null {
  return currentLevelId;
}

/** Subscribe (useSyncExternalStore-compatible). */
export function subscribeTopoFrameStatus(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Test/lifecycle reset. */
export function resetTopoFrameStatusForTest(): void {
  currentLevelId = null;
  store.reset(EMPTY_STATUS);
}

let currentLevelId: string | null = null;

function sameGroups(a: readonly TopoBakedGroup[], b: readonly TopoBakedGroup[]): boolean {
  return a.length === b.length && a.every((group, index) => group === b[index]);
}
