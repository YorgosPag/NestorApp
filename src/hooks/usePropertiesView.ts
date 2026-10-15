'use client';

/**
 * @fileoverview **Η προβολή της «Διαθέσιμα Ακίνητα» (πλέγμα ‖ κάτοψη), δεμένη στο URL** — πρότυπο `useListMapView`.
 * @module hooks/usePropertiesView
 * @see lib/properties/property-filters-url · hooks/list-map/useListMapView · ADR-840 Α2 + §7.7
 *
 * 🔴 **`replace`, ΟΧΙ `push` — και είναι η διόρθωση, όχι λεπτομέρεια.** Ως τις 2026-10-15 το πλέγμα έκανε
 *    `router.push('/properties?view=floorplan')`: νέα εγγραφή ιστορικού **χωρίς** τα φίλτρα. Ακόμη κι αν τα
 *    κουβαλούσε, φίλτρο αλλαγμένο στην κάτοψη θα «ξεχνιόταν» στο «πίσω» προς την εγγραφή του πλέγματος. Οι δύο
 *    προβολές είναι **φακοί της ΙΔΙΑΣ αναζήτησης** (ADR-840 Α2) ⇒ μία εγγραφή, ένα σύνολο φίλτρων· ο δρόμος από τη
 *    μία στην άλλη είναι το κουμπί της οθόνης, όχι το «πίσω».
 *
 * ⚠️ Ανάγνωση με `useUrlQuery` — το `useSearchParams` δεν βλέπει το `replaceState` στον dev· δίνει **μόνο** την τιμή
 *    server/ενυδάτωσης (αλλιώς η κάτοψη θα ζωγραφιζόταν πρώτα ως πλέγμα).
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { useUrlQuery } from '@/hooks/useUrlQuery';
import {
  PROPERTIES_SELECTED_PARAM,
  PROPERTIES_VIEW,
  type PropertiesView,
} from '@/lib/properties/property-filters-url';
import { replaceUrlSearchParams } from '@/lib/url-query-state';

export interface PropertiesViewState {
  readonly view: PropertiesView;
  /** Το ακίνητο που ζητήθηκε επιλεγμένο (`?selected=`), ή `null`. */
  readonly selectedId: string | null;
  /** Αλλάζει προβολή κρατώντας **κάθε** άλλο κλειδί (φίλτρα). `selectedId` ⇒ γράφεται· παραλείπεται ⇒ σβήνεται. */
  readonly setView: (view: PropertiesView, selectedId?: string) => void;
}

export function usePropertiesView(): PropertiesViewState {
  // Το query του αιτήματος για server/ενυδάτωση — αλλιώς η πρώτη ζωγραφιά θα ήταν η κενή κατάσταση.
  const query = useUrlQuery(useSearchParams()?.toString());
  const params = useMemo(() => new URLSearchParams(query), [query]);

  const setView = useCallback((view: PropertiesView, selectedId?: string) => {
    replaceUrlSearchParams((live) => {
      PROPERTIES_VIEW.write(view, live);
      if (selectedId) live.set(PROPERTIES_SELECTED_PARAM, selectedId);
      else live.delete(PROPERTIES_SELECTED_PARAM);
    });
  }, []);

  return {
    view: PROPERTIES_VIEW.parse(params),
    selectedId: params.get(PROPERTIES_SELECTED_PARAM),
    setView,
  };
}
