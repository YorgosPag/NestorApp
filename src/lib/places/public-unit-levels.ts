/**
 * @fileoverview **Οι μονάδες ενός κτιρίου ανά στάθμη** (ADR-900 §8 #2, 2β.4) — ο πρώτος καταναλωτής του `public_units`.
 * @module lib/places/public-unit-levels
 *
 * Σχήμα Zillow «building page» (όλες οι μονάδες ενός κτιρίου σε μία σελίδα), με την αυστηρότητα του επιπέδου Α:
 * μόνο **πλήθος ανά στάθμη** — κανένας κάτοχος, ΚΑΕΚ ή πόρτα (δεν υπάρχουν καν στο έγγραφο). Μετρούν μόνο οι
 * `approved`: η `historical` (κύκλος UPRN) **δεν** είναι πια μονάδα του κτιρίου.
 *
 * Καθαρό· η σειρά είναι η **μία** διάταξη στάθμεων (`compareFloorRefs`, σειρά Spitogatos).
 */

import { compareFloorRefs } from '@/lib/floor/floor-level-range';
import { floorRefKey, type FloorRef } from '@/lib/floor/floor-ref';
import type { PublicUnit } from '@/types/geo/public-place';

export interface PublicUnitLevel {
  /** `null` = μονάδα με επαληθευμένο ΚΑΕΚ αλλά χωρίς γνωστή στάθμη — μετριέται, δεν κρύβεται. */
  readonly level: FloorRef | null;
  readonly count: number;
}

export interface PublicUnitLevels {
  readonly total: number;
  readonly levels: readonly PublicUnitLevel[];
}

const UNKNOWN_LEVEL = 'unknown';

export function publicUnitLevels(units: readonly PublicUnit[]): PublicUnitLevels {
  const byKey = new Map<string, { level: FloorRef | null; count: number }>();
  for (const unit of units) {
    if (unit.status !== 'approved') continue;
    const level = unit.level?.value ?? null;
    const key = level === null ? UNKNOWN_LEVEL : floorRefKey(level);
    const entry = byKey.get(key) ?? { level, count: 0 };
    byKey.set(key, { level, count: entry.count + 1 });
  }
  const levels = [...byKey.values()].sort((a, b) => {
    if (a.level === null) return 1;
    if (b.level === null) return -1;
    return compareFloorRefs(a.level, b.level);
  });
  return { total: levels.reduce((sum, entry) => sum + entry.count, 0), levels };
}
