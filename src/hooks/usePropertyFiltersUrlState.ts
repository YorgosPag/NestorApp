'use client';

/**
 * @fileoverview **ΜΙΑ κατάσταση φίλτρων ακινήτων — η διεύθυνση.** Όσες προβολές κι αν τη διαβάσουν, βλέπουν την ίδια.
 * @module hooks/usePropertyFiltersUrlState
 * @see lib/properties/property-filters-url (η σύμβαση) · lib/url-query-state (ο ΕΝΑΣ γραφέας) · ADR-840 §7.7
 *
 * 🔑 **Δεν υπάρχει `useState` εδώ, επίτηδες.** Η κατάσταση **παράγεται** από το URL σε κάθε render — άρα δύο
 *    προβολές (πλέγμα · κάτοψη), ένα remount, ένα refresh, ένα «πίσω» δεν μπορούν να διαφωνήσουν: δεν υπάρχει
 *    δεύτερο αντίγραφο να μείνει πίσω.
 *
 * 🔴 **Ο καταρράκτης έργο → κτίριο → όροφος κρίνεται ΚΑΙ για ό,τι έρχεται από σύνδεσμο** (ADR-840 §7.6): ο
 *    `reconcileLocationSelection` εφαρμόζεται στην **παραγωγή**, όχι με εγγραφή σε effect. Με άδειο κατάλογο
 *    (δεδομένα που φορτώνουν) δεν αλλάζει τίποτα ⇒ η διεύθυνση **δεν** «καθαρίζεται» πριν φτάσουν τα ακίνητα.
 *
 * ⚠️ **Η εγγραφή διαβάζει τα ΖΩΝΤΑΝΑ params**, όχι το `filters` του render: γρήγορη πληκτρολόγηση ή δύο αλλαγές
 *    στο ίδιο tick δεν πατούν η μία την άλλη (καμία μπαγιάτικη closure).
 * ⚠️ `replaceState`, όχι `pushState`: κάθε πλήκτρο δεν γίνεται εγγραφή ιστορικού· το «πίσω» φεύγει από τη σελίδα,
 *    και η επιστροφή (εμπρός / άνοιγμα ακινήτου → πίσω) βρίσκει τη διεύθυνση **με** τα φίλτρα.
 */

import { useCallback, useMemo } from 'react';

import { useLiveSearchParams } from '@/hooks/useUrlQuery';
import { parsePropertyFilters, writePropertyFilters } from '@/lib/properties/property-filters-url';
import { reconcileLocationSelection, type LocatedProperty } from '@/lib/properties/property-location';
import { replaceUrlSearchParams } from '@/lib/url-query-state';
import type { FilterState } from '@/types/property-viewer';

export interface PropertyFiltersUrlState {
  readonly filters: FilterState;
  /** Συγχωνεύει την αλλαγή στα ζωντανά φίλτρα, εφαρμόζει τον καταρράκτη και τη γράφει στη διεύθυνση. */
  readonly updateFilters: (change: Partial<FilterState>) => void;
}

/**
 * @param catalog Ο κατάλογος πάνω στον οποίο κρίνεται ο καταρράκτης τοποθεσίας (τα ακίνητα που φτάνουν στην οθόνη).
 */
export function usePropertyFiltersUrlState(catalog: readonly LocatedProperty[]): PropertyFiltersUrlState {
  // Το query του αιτήματος για server/ενυδάτωση — αλλιώς η πρώτη ζωγραφιά θα ήταν η κενή κατάσταση.
  const params = useLiveSearchParams();

  const filters = useMemo(
    () => reconcileLocationSelection(parsePropertyFilters(params), catalog),
    [params, catalog],
  );

  const updateFilters = useCallback(
    (change: Partial<FilterState>) => {
      replaceUrlSearchParams((params) => {
        const next = reconcileLocationSelection({ ...parsePropertyFilters(params), ...change }, catalog);
        writePropertyFilters(next, params);
      });
    },
    [catalog],
  );

  return { filters, updateFilters };
}
