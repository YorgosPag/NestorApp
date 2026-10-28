'use client';

/**
 * @fileoverview **Η όψη της ενιαίας οθόνης ακινήτων (πλέγμα ‖ λίστα ‖ κάτοψη), δεμένη στο URL** — πρότυπο `useListMapView`.
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

import { useCallback } from 'react';

import { useLiveSearchParams } from '@/hooks/useUrlQuery';
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
  /**
   * Αλλάζει όψη κρατώντας **κάθε** άλλο κλειδί — φίλτρα **και επιλογή** (ADR-840 Σ3: η επιλογή είναι της οθόνης, όχι
   * του φακού). `selectedId` ⇒ γράφεται· `null` ⇒ σβήνεται· παραλείπεται ⇒ μένει ό,τι ήταν.
   * ⚠️ Ως το Σ3 η παράλειψη **έσβηνε** την επιλογή — σωστό όταν κάθε όψη είχε δική της, λάθος στη μία οθόνη.
   */
  readonly setView: (view: PropertiesView, selectedId?: string | null) => void;
}

export function usePropertiesView(): PropertiesViewState {
  // Το query του αιτήματος για server/ενυδάτωση — αλλιώς η πρώτη ζωγραφιά θα ήταν η κενή κατάσταση.
  const params = useLiveSearchParams();

  const setView = useCallback((view: PropertiesView, selectedId?: string | null) => {
    replaceUrlSearchParams((live) => {
      PROPERTIES_VIEW.write(view, live);
      if (selectedId) live.set(PROPERTIES_SELECTED_PARAM, selectedId);
      else if (selectedId === null) live.delete(PROPERTIES_SELECTED_PARAM);
    });
  }, []);

  return {
    view: PROPERTIES_VIEW.parse(params),
    selectedId: params.get(PROPERTIES_SELECTED_PARAM),
    setView,
  };
}
