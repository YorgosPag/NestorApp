'use client';
/**
 * @fileoverview **Υπερχείλιση ενεργειών κατά προτεραιότητα** — πόσες ενέργειες χωρούν στη γραμμή, οι υπόλοιπες στο μενού.
 * @related ADR-777 §8.87.7 · `EntityHeaderActions.tsx` · `hooks/media/usePriorityOverflow.ts` (ο ΕΝΑΣ μηχανισμός)
 * @module core/entity-headers/action-overflow
 *
 * 🔑 Η αριθμητική και η μέτρηση ζουν στο `usePriorityOverflow` (γενικεύτηκαν όταν η γραμμή σημάτων της κάρτας χρειάστηκε
 *   την ίδια ερώτηση — ADR-912 §11). Εδώ μένει **μόνο** ό,τι είναι της κεφαλίδας: τα σημάδια και το πλάτος του μενού.
 */
import {
  usePriorityOverflow,
  type PriorityOverflow,
  type PriorityOverflowSpec,
} from '@/hooks/media/usePriorityOverflow';

/** Σημάδι πάνω σε κάθε κουμπί ενέργειας — αυτά μετρά ο παρατηρητής. */
export const ENTITY_ACTION_ATTR = 'data-entity-action';
/** Σημάδι πάνω στο κουμπί «Περισσότερες ενέργειες». */
export const ENTITY_ACTION_MORE_ATTR = 'data-entity-action-more';

const ENTITY_ACTION_OVERFLOW: PriorityOverflowSpec = {
  itemAttr: ENTITY_ACTION_ATTR,
  moreAttr: ENTITY_ACTION_MORE_ATTR,
  // Πλάτος του κουμπιού «Περισσότερα» πριν ζωγραφιστεί (`h-8` εικονίδιο).
  moreFallbackPx: 36,
};

export type ActionOverflow = PriorityOverflow<HTMLDivElement>;

/**
 * Το δοχείο πρέπει να έχει πλάτος **ανεξάρτητο από το πόσες ενέργειες κρύβονται** (οι κρυμμένες μένουν στη ροή,
 * αόρατες) — αλλιώς, μόλις κρυφτεί μία, το δοχείο στενεύει και ο χώρος που ξαναβρέθηκε δεν φαίνεται ποτέ.
 */
export function useActionOverflow(count: number): ActionOverflow {
  return usePriorityOverflow<HTMLDivElement>(count, ENTITY_ACTION_OVERFLOW);
}
