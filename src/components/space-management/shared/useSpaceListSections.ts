'use client';

/**
 * useSpaceListSections — τι δείχνει η λίστα θέσεων ή αποθηκών (σελίδες `/spaces/*`)
 *
 * Γρήγορες επιλογές **διάθεσης** (κουβάδες του `commercialStatus`, ADR-777 §8.60.20) + ελεύθερη
 * αναζήτηση → ταξινόμηση σε ενότητες ανά μονάδα τιμής (§8.60.14.14). Ήταν γραμμένο δύο φορές
 * (`ParkingsList` / `StoragesList`)· κάθε λίστα δίνει πλέον μόνο ό,τι είναι δικό της: τα πεδία
 * αναζήτησης, το κλειδί ταξινόμησης και τη σειρά ισοπαλίας.
 *
 * @module components/space-management/shared/useSpaceListSections
 */

import { useMemo } from 'react';
import type { EntityListState } from '@/hooks/useEntityListState';
import type { SortableValue } from '@/lib/array-utils';
import type { PricedPropertyLike } from '@/lib/properties/price-resolver';
import { sortIntoPriceClassSections, type PriceClassSections } from '@/lib/properties/price-class-sections';
import { matchesSearchTerm, type Searchable } from '@/lib/search/search';
import {
  matchesAnySpaceAvailability,
  spaceAvailabilityRank,
  type SpaceAvailabilitySource,
} from '@/lib/spaces/space-availability';
import { compareByNameThenId } from '@/lib/ordering/total-name-order';

/** Το πεδίο ταξινόμησης «κατάσταση» — ΚΟΙΝΟ για κάθε χώρο: ο κουβάς διάθεσης (ADR-777 §8.60.20). */
const STATUS_SORT_FIELD = 'status';

/** Ολική σειρά ισοπαλίας «όνομα → `id`» — ίδια για κάθε λίστα χώρων, με το δικό της όνομα. */
export function tieBreakByName<T extends { readonly id: string }>(nameOf: (item: T) => string) {
  return (a: T, b: T): number => compareByNameThenId(nameOf(a), a.id, nameOf(b), b.id);
}

export interface SpaceListRules<T, TSort extends string> {
  /** Τα πεδία που ψάχνει η αναζήτηση. */
  readonly searchFields: (item: T) => readonly Searchable[];
  /** Το κλειδί κάθε σειράς **εκτός** της τιμής και της κατάστασης (εκείνες είναι κοινές). */
  readonly sortValue: (item: T, field: TSort) => SortableValue;
  /** Ολική σειρά για ισοπαλίες. */
  readonly tieBreak: (a: T, b: T) => number;
}

export function useSpaceListSections<T extends PricedPropertyLike & SpaceAvailabilitySource, TSort extends string>(
  items: readonly T[],
  list: Pick<EntityListState<TSort>, 'searchTerm' | 'selectedStatuses' | 'sortBy' | 'sortOrder'>,
  rules: SpaceListRules<T, TSort>,
): { readonly filtered: T[]; readonly sections: PriceClassSections<T> } {
  const { searchFields, sortValue, tieBreak } = rules;

  const filtered = useMemo(
    () => items.filter((item) =>
      matchesAnySpaceAvailability(item, list.selectedStatuses)
      && matchesSearchTerm(searchFields(item), list.searchTerm)),
    [items, list.searchTerm, list.selectedStatuses, searchFields],
  );

  // «Κατά αξία» = ΠΡΩΤΑ η μονάδα, ΜΕΤΑ ο αριθμός (Revit `Sort By` → `Then By`)· κάθε άλλη σειρά
  // είναι ΕΝΑ τμήμα χωρίς επιγραφή.
  const sections = useMemo(
    () => sortIntoPriceClassSections(filtered, {
      byPrice: list.sortBy === 'value',
      direction: list.sortOrder,
      tieBreak,
      valueOf: (item) =>
        list.sortBy === STATUS_SORT_FIELD ? spaceAvailabilityRank(item) : sortValue(item, list.sortBy),
    }),
    [filtered, list.sortBy, list.sortOrder, sortValue, tieBreak],
  );

  return { filtered, sections };
}
