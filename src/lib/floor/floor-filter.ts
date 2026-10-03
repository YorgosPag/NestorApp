/**
 * @fileoverview **Το φίλτρο ορόφου** — ένα, για ακίνητα · θέσεις · αποθήκες (ADR-903 §6).
 * @module lib/floor/floor-filter
 *
 * 🔴 Ως τις 2026-10-03 το φίλτρο ορόφου των θέσεων/αποθηκών είχε **σταθερές** επιλογές (`basement-1`,
 * `first`, `rooftop`…) που συγκρίνονταν με το ελεύθερο κείμενο του εγγράφου («Υπόγειο -1», «-1») ⇒ **δεν
 * ταίριαζαν ποτέ**. Των ακινήτων έδειχνε τον ωμό αριθμό («2») ως ετικέτα.
 *
 * Πλέον (idealista/Zillow: οι επιλογές προκύπτουν **από τα δεδομένα**, ταξινομημένες κατά στάθμη):
 * - **Επιλογές** = οι όροφοι που **υπάρχουν** στη λίστα — ποτέ επιλογή που δίνει 0 αποτελέσματα.
 * - **Τιμή** = `αριθμός:είδος` — πυλωτή και ισόγειο έχουν **και οι δύο** αριθμό 0, και δεν συγχωνεύονται.
 * - **Ετικέτα** = ο **ένας** μορφοποιητής (`useFloorLabel` περνιέται από τον καλούντα — καθαρό module).
 */

import { floorRefKey, type FloorRef } from './floor-ref';
import { hostedFloorRef } from './hosted-floor';

type FloorBearing = { readonly floor?: unknown; readonly floorKind?: unknown };

/** Το κλειδί σύγκρισης ενός ορόφου στο φίλτρο — `null` όταν το στοιχείο δεν έχει όροφο. */
export function floorFilterKey(item: FloorBearing): string | null {
  const ref = hostedFloorRef(item);
  return ref === null ? null : floorRefKey(ref);
}

/** Ταιριάζει το στοιχείο με την επιλεγμένη τιμή φίλτρου (`'all'`/κενό ⇒ πάντα). */
export function matchesFloorFilter(item: FloorBearing, value: string | undefined): boolean {
  if (!value || value === 'all') return true;
  return floorFilterKey(item) === value;
}

/** Οι επιλογές: οι όροφοι που υπάρχουν στα στοιχεία, μοναδικοί, κατά στάθμη (υπόγεια → δώμα). */
export function floorFilterOptions(
  items: readonly FloorBearing[],
  floorLabel: (ref: FloorRef) => string,
): Array<{ value: string; label: string }> {
  const byKey = new Map<string, FloorRef>();
  for (const item of items) {
    const ref = hostedFloorRef(item);
    const key = floorFilterKey(item);
    if (ref !== null && key !== null && !byKey.has(key)) byKey.set(key, ref);
  }
  return [...byKey.entries()]
    .sort(([, a], [, b]) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER))
    .map(([value, ref]) => ({ value, label: floorLabel(ref) }));
}
