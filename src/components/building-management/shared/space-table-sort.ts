/**
 * @fileoverview **Η σειρά ενός πίνακα χώρων κτιρίου** — καθαρή, χωρίς React: ο πίνακας (`BuildingSpaceTable`) **και** η
 * εξαγωγή XLSX (ADR-898 Φ4β) ρωτούν την ΙΔΙΑ συνάρτηση, ώστε το αρχείο να έχει ό,τι βλέπει ο άνθρωπος, με την ίδια σειρά.
 * @module components/building-management/shared/space-table-sort
 */

import { compareSortValues } from '@/lib/array-utils';

import type { SortDirection, SpaceColumn, SpaceSortGroup } from './types';

/** Ποια στήλη και προς τα πού — `null` = η σειρά των δεδομένων. */
export interface SortState {
  readonly key: string;
  readonly direction: SortDirection;
}

/** Κλικ σε επικεφαλίδα: ίδια στήλη ⇒ αντιστροφή · άλλη ⇒ αύξουσα. */
export function nextSortState(current: SortState | null, columnKey: string): SortState {
  if (current?.key === columnKey) return { key: columnKey, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  return { key: columnKey, direction: 'asc' };
}

export function ariaSortOf(sort: SortState | null, columnKey: string): 'ascending' | 'descending' | 'none' {
  if (sort?.key !== columnKey) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

/**
 * Οι γραμμές του πίνακα ως **ομάδες**, ταξινομημένες.
 *
 * - Στήλη με `sortGroups` ⇒ **εκείνη** διαμερίζει (Revit `Sort By` ομάδα → `Then By` τιμή):
 *   στοιχεία δύο ομάδων **δεν συγκρίνονται ποτέ** (ADR-777 §8.60.14.14 — τιμή πώλησης, €/μήνα
 *   και €/νύχτα δεν είναι ένας άξονας).
 * - Στήλη με `sortValue` ⇒ **μία** ομάδα χωρίς επιγραφή, με τον ΕΝΑ συγκριτή της εφαρμογής
 *   (κενά τελευταία και στις δύο κατευθύνσεις, ελληνική σειρά — `lib/array-utils`).
 */
export function sortIntoGroups<T>(
  items: readonly T[],
  columns: readonly SpaceColumn<T>[],
  sort: SortState | null,
): readonly SpaceSortGroup<T>[] {
  const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
  if (!sort || !column) return [{ key: 'all', label: null, items }];

  if (column.sortGroups) return column.sortGroups(items, sort.direction);

  const extractor = column.sortValue;
  if (!extractor) return [{ key: 'all', label: null, items }];
  const sorted = [...items].sort((a, b) => compareSortValues(extractor(a), extractor(b), sort.direction));
  return [{ key: 'all', label: null, items: sorted }];
}
