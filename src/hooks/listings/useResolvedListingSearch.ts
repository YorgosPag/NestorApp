'use client';

/**
 * @fileoverview **Από τη διεύθυνση στα κρίσιμα φίλτρα** — η αναφορά σε περιοχή γίνεται όριο.
 * @related ADR-883 · `lib/listings/listing-filters.ts` (`resolveListingSearch`) · `hooks/geo/useAdminBoundary.ts`
 * @module hooks/listings/useResolvedListingSearch
 *
 * 🔑 **Γιατί ζει έξω από την οθόνη 2**: το `SearchResultsContent` κρατά ήδη τη διάταξη, τις
 * τέσσερις λογιστικές και τη σειρά — μια τέταρτη ευθύνη εκεί θα το έσπρωχνε πάνω από το
 * όριο των 500 γραμμών **και** θα έκρυβε την πολιτική μέσα σε JSX.
 *
 * ⚠️ **Όσο το όριο φορτώνει, `hold: true`** — η ανάγνωση περιμένει *(δες `usePublicListings`)*.
 * Τα φίλτρα που επιστρέφονται τότε έχουν `near: null` μόνο για να έχει τύπο ο κριτής· δεν
 * κρίνουν τίποτα, αφού η λίστα είναι άδεια όσο διαρκεί η αναμονή.
 */

import { useMemo } from 'react';

import { useAdminBoundary, type AdminBoundaryState } from '@/hooks/geo/useAdminBoundary';
import {
  resolveListingSearch,
  searchRegionId,
  type ListingFilters,
  type ListingSearch,
} from '@/lib/listings/listing-filters';

export interface ResolvedListingSearch {
  /** Τα φίλτρα που **κρίνουν** — με το όριο στη θέση της αναφοράς. */
  readonly filters: ListingFilters;
  /** Η περιοχή δεν είναι ακόμη γνωστή: **καμία** ανάγνωση, καμία κρίση. */
  readonly hold: boolean;
  /** Η κατάσταση του ορίου — για τον χάρτη και για το «όριο μη διαθέσιμο». */
  readonly region: AdminBoundaryState;
}

export function useResolvedListingSearch(search: ListingSearch): ResolvedListingSearch {
  const region = useAdminBoundary(searchRegionId(search.near));

  return useMemo(() => {
    const geometry = region.status === 'ready' ? region.boundary.region : null;
    const resolved = resolveListingSearch(search, geometry);
    return {
      filters: resolved ?? { ...search, near: null },
      hold: resolved === null,
      region,
    };
  }, [search, region]);
}
