/**
 * ADR-581 — Match/Transfer brush store (σταγονόμετρο/σύριγγα state).
 *
 * Zero-React singleton (πρότυπο `HoverStore` / `ImmediatePositionStore`): κρατά την
 * «φορτωμένη» πηγή του πινέλου. `Alt+click` σε μια οντότητα → φορτώνει την πηγή εδώ
 * (σταγονόμετρο)· `Ctrl+Alt+click` σε άλλη → «ενίεται» με τους default ρόλους της
 * συνήθειας (σύριγγα), διαβάζοντας ΑΥΤΗ την πηγή.
 *
 * Χτισμένο πάνω στο SSoT `createExternalStore` (WAVE 3) — καμία νέα pub/sub μηχανή.
 * Καθαρά data· zero React/DOM. Οι leaf subscribers (cursor badge) το διαβάζουν μέσω
 * `useSyncExternalStore(subscribeMatchBrush, getMatchBrushSource)`.
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { EntityType } from '../../types/base-entity';

/** Η φορτωμένη πηγή του πινέλου (id + τύπος οντότητας). */
export interface MatchBrushSource {
  readonly id: string;
  readonly type: EntityType;
}

const store = createExternalStore<MatchBrushSource | null>(null);

/** Τρέχουσα πηγή του πινέλου, ή `null` αν κανένα σταγονόμετρο δεν έχει φορτωθεί. */
export function getMatchBrushSource(): MatchBrushSource | null {
  return store.get();
}

/** Φορτώνει (ή καθαρίζει με `null`) την πηγή του πινέλου. */
export function setMatchBrushSource(source: MatchBrushSource | null): void {
  store.set(source);
}

/** Αδειάζει το πινέλο (μετά από inject / Escape / αλλαγή εργαλείου). */
export function clearMatchBrushSource(): void {
  store.set(null);
}

/** `true` αν υπάρχει φορτωμένη πηγή (η σύριγγα είναι έτοιμη να ενέσει). */
export function hasMatchBrushSource(): boolean {
  return store.get() !== null;
}

/** Subscription για leaf subscribers (cursor badge / status hint). */
export function subscribeMatchBrush(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** Test hook — επαναφορά στο κενό. */
export function __resetMatchBrushStore(): void {
  store.reset(null);
}
