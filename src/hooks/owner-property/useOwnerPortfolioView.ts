'use client';

/**
 * **Η προβολή του χαρτοφυλακίου (Λίστα | Χάρτης) ζει στο URL**, όπως στα portals (ADR-777 §8.71).
 *
 * 🔑 Ανάγνωση με `useUrlQuery` και γραφή με `replaceUrlSearchParams`: το **ένα** σημείο που
 * διαβάζει και γράφει κατάσταση στο query string (`lib/url-query-state`). Η προβολή επιβιώνει
 * σε reload, κοινοποίηση και πίσω/μπροστά, χωρίς γύρο στον server και χωρίς remount της λίστας.
 *
 * ⚠️ **Το URL ζητά· η σελίδα αποφασίζει.** Αν ο σύνδεσμος λέει `?view=map` αλλά το χαρτοφυλάκιο
 * δεν έχει αρκετά σημάδια, αποδίδεται λίστα **χωρίς** γραφή στο URL: ο σύνδεσμος μένει όπως
 * τον έστειλε ο άνθρωπος, και ξαναγίνεται χάρτης μόλις δημοσιευτεί το επόμενο ακίνητο.
 * 🔑 Από την §8.75 η απόφαση είναι **δομική**: το hook καλείται **μόνο** από τη διάταξη `tabs`,
 * που υπάρχει μόνο όταν υπάρχει χάρτης (`OwnerPortfolio`). Στις `list` / `split` το URL ούτε
 * διαβάζεται ούτε γράφεται — γι' αυτό η παλιά παράμετρος `mapAvailable` έφυγε (θα ήταν πάντα `true`).
 */

import { useCallback, useMemo } from 'react';

import { useUrlQuery } from '@/hooks/useUrlQuery';
import {
  parseOwnerPortfolioView,
  writeOwnerPortfolioView,
  type OwnerPortfolioView,
} from '@/lib/owner-property/owner-portfolio-map';
import { replaceUrlSearchParams } from '@/lib/url-query-state';

export interface OwnerPortfolioViewState {
  /** Η προβολή που **αποδίδεται**: ό,τι ζητά το URL, εφόσον η σελίδα μπορεί να το δείξει. */
  readonly view: OwnerPortfolioView;
  readonly setView: (view: OwnerPortfolioView) => void;
}

export function useOwnerPortfolioView(): OwnerPortfolioViewState {
  const query = useUrlQuery();
  const requested = useMemo(() => parseOwnerPortfolioView(new URLSearchParams(query)), [query]);

  const setView = useCallback((view: OwnerPortfolioView) => {
    replaceUrlSearchParams((params) => writeOwnerPortfolioView(view, params));
  }, []);

  return { view: requested, setView };
}
