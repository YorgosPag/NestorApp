/**
 * ADR-581 — Match/Transfer habit store (τοπική «συνήθεια» → default checklist).
 *
 * Μαθαίνει ΠΟΙΟΥΣ σημασιολογικούς ρόλους επιλέγει συνήθως ο χρήστης ανά ζεύγος
 * (sourceType → targetType) και προτείνει το αρχικό checklist του dialog. Καθαρά
 * frequency stats — καμία τιμή, κανένα geometry· μόνο on/off προτίμηση ρόλων.
 *
 * Persist μέσω του SSoT `createPersistedValue` (localStorage + SSR-safe + quota-guard)
 * — δεν ξαναγράφει localStorage plumbing. Κάθε `recordApply` παράγει ΝΕΟ immutable
 * snapshot (ώστε το persist να πυροδοτείται).
 *
 * Cold-start default (κανένα στατιστικό): style + geometry ON, τα υπόλοιπα OFF — οι
 * πιο ασφαλείς/συχνές μεταφορές (AutoCAD MATCHPROP-like), χωρίς να πειράζει δομικά.
 */

import { createPersistedValue } from '../../stores/createPersistedValue';
import { STORAGE_KEYS } from '../../utils/storage-utils';
import type { SemanticRole } from './match-types';
import { roleFamily } from './semantic-roles';

/** Στατιστικά ενός ρόλου: πόσες φορές προσφέρθηκε vs επιλέχθηκε. */
interface RoleStat {
  readonly offered: number;
  readonly applied: number;
}

/** Στατιστικά όλων των ρόλων ενός ζεύγους τύπων. */
type PairStats = Readonly<Record<string, RoleStat>>;

/** Χάρτης `${sourceType}>${targetType}` → PairStats. */
type HabitData = Readonly<Record<string, PairStats>>;

/** Οικογένειες ρόλων που είναι ON στο cold-start (καμία εμπειρία ακόμη). */
const COLD_START_ON_FAMILIES: ReadonlySet<string> = new Set<string>(['style', 'geometry']);

/** Πάνω από αυτό το ποσοστό επιλογής → ο ρόλος είναι default ON. */
const HABIT_ON_THRESHOLD = 0.5;

const store = createPersistedValue<HabitData>(STORAGE_KEYS.MATCH_PROPERTIES_HABIT, {});

function pairKey(sourceType: string, targetType: string): string {
  return `${sourceType}>${targetType}`;
}

/** Cold-start: style/geometry ON, υπόλοιπα OFF. */
function coldStartOn(role: SemanticRole): boolean {
  return COLD_START_ON_FAMILIES.has(roleFamily(role));
}

/**
 * Αρχικό checklist για ένα ζεύγος τύπων: για κάθε προσφερόμενο ρόλο επιστρέφει αν
 * είναι default ON. Με στατιστικά → applied/offered ≥ threshold· χωρίς → cold-start.
 */
export function getDefaultChecklist(
  sourceType: string,
  targetType: string,
  offeredRoles: readonly SemanticRole[],
): Set<SemanticRole> {
  const stats = store.get()[pairKey(sourceType, targetType)];
  const on = new Set<SemanticRole>();
  for (const role of offeredRoles) {
    const stat = stats?.[role];
    if (stat && stat.offered > 0) {
      if (stat.applied / stat.offered >= HABIT_ON_THRESHOLD) on.add(role);
    } else if (coldStartOn(role)) {
      on.add(role);
    }
  }
  return on;
}

/**
 * Καταγράφει ένα apply: κάθε προσφερόμενος ρόλος `offered++`· κάθε επιλεγμένος
 * επιπλέον `applied++`. Immutable update → persist.
 */
export function recordApply(
  sourceType: string,
  targetType: string,
  offeredRoles: readonly SemanticRole[],
  selectedRoles: ReadonlySet<SemanticRole>,
): void {
  if (offeredRoles.length === 0) return;
  const key = pairKey(sourceType, targetType);
  const data = store.get();
  const prevPair = data[key] ?? {};
  const nextPair: Record<string, RoleStat> = { ...prevPair };
  for (const role of offeredRoles) {
    const prev = prevPair[role] ?? { offered: 0, applied: 0 };
    nextPair[role] = {
      offered: prev.offered + 1,
      applied: prev.applied + (selectedRoles.has(role) ? 1 : 0),
    };
  }
  store.set({ ...data, [key]: nextPair });
}

/** Reactive read για UI (π.χ. «μαθημένο» badge). */
export function subscribeHabit(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** Test hook — καθαρίζει όλα τα στατιστικά. */
export function __resetMatchHabitStore(): void {
  store.reset();
}
